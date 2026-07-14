import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

const ROOT_ID = 'lumi-reading-ruler'
const STORAGE_KEY = 'lumi-reading-ruler-v2-bottom'
const GLOBAL_CLEANUP_KEY = '__lumiReadingRulerCleanup'

const DEFAULT_BOTTOM = 118
const MIN_BOTTOM = 8
const TOP_MARGIN = 32
const RULER_HEIGHT = 46

type CleanupWindow = Window & {
  [GLOBAL_CLEANUP_KEY]?: () => void
}

type DragPoint = PointerEvent | MouseEvent | TouchEvent

function viewportHeight(): number {
  return window.innerHeight || document.documentElement.clientHeight || 720
}

function readSavedBottom(): number | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function clampBottom(value: number): number {
  const maxBottom = Math.max(MIN_BOTTOM, viewportHeight() - RULER_HEIGHT - TOP_MARGIN)
  return Math.max(MIN_BOTTOM, Math.min(maxBottom, value))
}

function saveBottom(value: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)))
}

function isVisibleElement(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < viewportHeight() &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  )
}

function isChatRoute(): boolean {
  return /(?:^|\/)chat\/[^/]+/.test(window.location.pathname)
}

function findInputAnchor(): HTMLElement | null {
  const textareas = Array.from(document.querySelectorAll('textarea')).filter(isVisibleElement)
  const lowerTextareas = textareas.filter((ta) => {
    const rect = ta.getBoundingClientRect()
    return rect.top > viewportHeight() * 0.45
  })

  for (const textarea of lowerTextareas) {
    let best: HTMLElement | null = textarea
    let node: HTMLElement | null = textarea

    while (node && node !== document.body && node !== document.documentElement) {
      const rect = node.getBoundingClientRect()
      const style = window.getComputedStyle(node)
      const isLikelyInputShell =
        rect.width >= window.innerWidth * 0.52 &&
        rect.height >= 36 &&
        rect.height <= Math.min(260, viewportHeight() * 0.36) &&
        rect.bottom >= viewportHeight() * 0.66 &&
        (style.position === 'fixed' ||
          style.position === 'absolute' ||
          style.position === 'sticky' ||
          /(^|\s|_)container(_|\s|$)|input|composer|bar/i.test(node.className.toString()))

      if (isLikelyInputShell) best = node
      node = node.parentElement
    }

    if (best) return best
  }

  return null
}

function computeSpawnBottom(): number {
  const anchor = findInputAnchor()
  if (!anchor) return DEFAULT_BOTTOM

  const rect = anchor.getBoundingClientRect()
  const bottom = viewportHeight() - rect.top + 8
  return Number.isFinite(bottom) ? bottom : DEFAULT_BOTTOM
}

function getClientY(event: DragPoint): number | null {
  if ('touches' in event) {
    const touch = event.touches[0] || event.changedTouches[0]
    return touch ? touch.clientY : null
  }

  return event.clientY
}

export function setup(ctx: SpindleFrontendContext) {
  const win = window as CleanupWindow
  win[GLOBAL_CLEANUP_KEY]?.()

  const removeStyle = ctx.dom.addStyle(`
    #${ROOT_ID} {
      position: fixed;
      inset-inline: 10px;
      bottom: ${clampBottom(readSavedBottom() ?? computeSpawnBottom())}px;
      height: ${RULER_HEIGHT}px;
      z-index: 2147483000;
      display: none;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      opacity: 0;
      transform: translateY(10px);
      transition:
        opacity 140ms ease,
        transform 140ms ease,
        bottom 80ms linear;

      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.035)),
        linear-gradient(180deg, rgba(32, 30, 42, 0.48), rgba(10, 10, 14, 0.54));
      backdrop-filter: blur(12px) saturate(118%);
      -webkit-backdrop-filter: blur(12px) saturate(118%);

      border-block: 1px solid rgba(235, 226, 255, 0.15);
      border-radius: 12px;
      box-shadow:
        0 -8px 20px rgba(0, 0, 0, 0.26),
        0 8px 20px rgba(0, 0, 0, 0.26),
        inset 0 1px 0 rgba(255, 255, 255, 0.08),
        inset 0 -1px 0 rgba(0, 0, 0, 0.28);
      overflow: visible;
    }

    #${ROOT_ID}[data-active="true"] {
      display: block;
      opacity: 0.88;
      transform: translateY(0);
    }

    #${ROOT_ID}[data-dragging="true"] {
      opacity: 0.98;
      transition: opacity 80ms ease;
    }

    #${ROOT_ID}::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background:
        repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 12px),
        linear-gradient(90deg, transparent, rgba(230, 218, 255, 0.08), transparent);
      opacity: 0.55;
    }

    #${ROOT_ID}::after {
      content: '';
      position: absolute;
      inset-inline: 8%;
      top: 50%;
      height: 1px;
      pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(235, 226, 255, 0.38), transparent);
      transform: translateY(-50%);
    }

    #${ROOT_ID} .reading-ruler-handle {
      position: absolute;
      left: 50%;
      top: -22px;
      width: min(232px, 48vw);
      height: 42px;
      transform: translateX(-50%);
      border: 0;
      padding: 0;
      border-radius: 999px;
      background: transparent;
      pointer-events: auto;
      touch-action: none;
      cursor: ns-resize;
      -webkit-tap-highlight-color: transparent;
    }

    #${ROOT_ID} .reading-ruler-handle::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 14px;
      width: min(168px, 36vw);
      height: 8px;
      transform: translateX(-50%);
      border-radius: 999px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(210, 204, 230, 0.35));
      border: 1px solid rgba(255, 255, 255, 0.38);
      box-shadow:
        0 4px 13px rgba(0, 0, 0, 0.55),
        inset 0 1px 0 rgba(255, 255, 255, 0.58);
    }

    #${ROOT_ID} .reading-ruler-handle::after {
      content: 'drag';
      position: absolute;
      left: 50%;
      top: 25px;
      transform: translateX(-50%);
      color: rgba(235, 226, 255, 0.45);
      font: 600 9px/1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    }

    #${ROOT_ID}[data-dragging="true"] .reading-ruler-handle::before {
      filter: brightness(1.12);
    }
  `)

  const wrapper = ctx.dom.inject(
    'body',
    `<div id="${ROOT_ID}" aria-label="Draggable reading ruler"><button class="reading-ruler-handle" type="button" aria-label="Drag reading ruler"></button></div>`,
    'beforeend',
  )

  const ruler = document.getElementById(ROOT_ID) as HTMLElement | null
  const handle = ruler?.querySelector('.reading-ruler-handle') as HTMLElement | null

  if (!ruler || !handle) {
    removeStyle()
    ctx.dom.uninject(wrapper)
    return () => undefined
  }

  let dragging = false
  let activePointerId: number | null = null
  let startY = 0
  let startBottom = 0
  let hasUserPosition = readSavedBottom() !== null
  let syncFrame = 0

  const applyBottom = (nextBottom: number, persist = true) => {
    const clamped = clampBottom(nextBottom)
    ruler.style.bottom = `${clamped}px`
    if (persist) {
      saveBottom(clamped)
      hasUserPosition = true
    }
  }

  const syncVisibility = () => {
    const active = isChatRoute()
    ruler.dataset.active = active ? 'true' : 'false'

    if (!active || dragging) return

    const saved = readSavedBottom()
    if (saved !== null) {
      applyBottom(saved, false)
      hasUserPosition = true
      return
    }

    if (!hasUserPosition) applyBottom(computeSpawnBottom(), false)
  }

  const scheduleSync = () => {
    cancelAnimationFrame(syncFrame)
    syncFrame = requestAnimationFrame(syncVisibility)
  }

  const beginDrag = (event: DragPoint) => {
    const clientY = getClientY(event)
    if (clientY === null) return

    dragging = true
    ruler.dataset.dragging = 'true'
    startY = clientY
    startBottom = Number.parseFloat(window.getComputedStyle(ruler).bottom) || computeSpawnBottom()

    if ('pointerId' in event) {
      activePointerId = event.pointerId
      try {
        handle.setPointerCapture(event.pointerId)
      } catch {
        // Some mobile webviews are dramatic about pointer capture. Window listeners below still handle the drag.
      }
    }

    event.preventDefault()
  }

  const continueDrag = (event: DragPoint) => {
    if (!dragging) return
    if ('pointerId' in event && activePointerId !== null && event.pointerId !== activePointerId) return

    const clientY = getClientY(event)
    if (clientY === null) return

    const delta = startY - clientY
    applyBottom(startBottom + delta)
    event.preventDefault()
  }

  const endDrag = (event?: DragPoint) => {
    if ('pointerId' in (event || {}) && activePointerId !== null && (event as PointerEvent).pointerId !== activePointerId) return

    if (event && 'pointerId' in event) {
      try {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore pointer-capture cleanup failures in older webviews.
      }
    }

    dragging = false
    activePointerId = null
    ruler.dataset.dragging = 'false'
  }

  const onResize = () => {
    const current = Number.parseFloat(window.getComputedStyle(ruler).bottom)
    applyBottom(Number.isFinite(current) ? current : computeSpawnBottom(), hasUserPosition)
    scheduleSync()
  }

  const observer = new MutationObserver(scheduleSync)
  observer.observe(document.body, { childList: true, subtree: true })

  handle.addEventListener('pointerdown', beginDrag as EventListener, { passive: false })
  window.addEventListener('pointermove', continueDrag as EventListener, { passive: false })
  window.addEventListener('pointerup', endDrag as EventListener, { passive: false })
  window.addEventListener('pointercancel', endDrag as EventListener, { passive: false })

  handle.addEventListener('mousedown', beginDrag as EventListener, { passive: false })
  window.addEventListener('mousemove', continueDrag as EventListener, { passive: false })
  window.addEventListener('mouseup', endDrag as EventListener, { passive: false })

  handle.addEventListener('touchstart', beginDrag as EventListener, { passive: false })
  window.addEventListener('touchmove', continueDrag as EventListener, { passive: false })
  window.addEventListener('touchend', endDrag as EventListener, { passive: false })
  window.addEventListener('touchcancel', endDrag as EventListener, { passive: false })

  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
  window.addEventListener('popstate', scheduleSync)
  window.addEventListener('hashchange', scheduleSync)

  const interval = window.setInterval(syncVisibility, 500)
  syncVisibility()

  const cleanup = () => {
    cancelAnimationFrame(syncFrame)
    window.clearInterval(interval)
    observer.disconnect()

    handle.removeEventListener('pointerdown', beginDrag as EventListener)
    window.removeEventListener('pointermove', continueDrag as EventListener)
    window.removeEventListener('pointerup', endDrag as EventListener)
    window.removeEventListener('pointercancel', endDrag as EventListener)

    handle.removeEventListener('mousedown', beginDrag as EventListener)
    window.removeEventListener('mousemove', continueDrag as EventListener)
    window.removeEventListener('mouseup', endDrag as EventListener)

    handle.removeEventListener('touchstart', beginDrag as EventListener)
    window.removeEventListener('touchmove', continueDrag as EventListener)
    window.removeEventListener('touchend', endDrag as EventListener)
    window.removeEventListener('touchcancel', endDrag as EventListener)

    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onResize)
    window.removeEventListener('popstate', scheduleSync)
    window.removeEventListener('hashchange', scheduleSync)

    removeStyle()
    ctx.dom.uninject(wrapper)
    ctx.dom.cleanup()

    if (win[GLOBAL_CLEANUP_KEY] === cleanup) delete win[GLOBAL_CLEANUP_KEY]
  }

  win[GLOBAL_CLEANUP_KEY] = cleanup

  return cleanup
}
