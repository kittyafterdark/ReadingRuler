import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

const ROOT_ID = 'lumi-reading-ruler'
const STORAGE_KEY = 'lumi-reading-ruler-v3-height'
const GLOBAL_CLEANUP_KEY = '__lumiReadingRulerCleanup'

const DEFAULT_HEIGHT = 84
const MIN_HEIGHT = 38
const TOP_MARGIN = 34
const DEFAULT_BOTTOM_ANCHOR = 118
const INPUT_GAP = 8
const RULER_Z_INDEX = 24

type CleanupWindow = Window & {
  [GLOBAL_CLEANUP_KEY]?: () => void
}

type DragPoint = PointerEvent | MouseEvent | TouchEvent

function viewportHeight(): number {
  return window.innerHeight || document.documentElement.clientHeight || 720
}

function viewportWidth(): number {
  return window.innerWidth || document.documentElement.clientWidth || 390
}

function readSavedHeight(): number | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function saveHeight(value: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)))
}

function clampHeight(value: number, bottomAnchor: number): number {
  const maxHeight = Math.max(MIN_HEIGHT, viewportHeight() - bottomAnchor - TOP_MARGIN)
  return Math.max(MIN_HEIGHT, Math.min(maxHeight, value))
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
  const candidates = Array.from(
    document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]'),
  ).filter(isVisibleElement)

  const lowerCandidates = candidates.filter((el) => {
    const rect = el.getBoundingClientRect()
    return rect.top > viewportHeight() * 0.45
  })

  for (const candidate of lowerCandidates) {
    let best: HTMLElement | null = candidate
    let node: HTMLElement | null = candidate

    while (node && node !== document.body && node !== document.documentElement) {
      const rect = node.getBoundingClientRect()
      const style = window.getComputedStyle(node)
      const className = node.className.toString()
      const id = node.id || ''
      const nameHint = `${className} ${id}`

      const isLikelyInputShell =
        rect.width >= viewportWidth() * 0.5 &&
        rect.height >= 34 &&
        rect.height <= Math.min(280, viewportHeight() * 0.38) &&
        rect.bottom >= viewportHeight() * 0.62 &&
        (style.position === 'fixed' ||
          style.position === 'absolute' ||
          style.position === 'sticky' ||
          /input|composer|message|textarea|prompt|bar|bottom|container/i.test(nameHint))

      if (isLikelyInputShell) best = node
      node = node.parentElement
    }

    if (best) return best
  }

  return null
}

function computeBottomAnchor(anchor: HTMLElement | null = findInputAnchor()): number {
  if (!anchor) return DEFAULT_BOTTOM_ANCHOR

  const rect = anchor.getBoundingClientRect()
  const bottom = viewportHeight() - rect.top + INPUT_GAP
  return Number.isFinite(bottom) ? Math.max(0, bottom) : DEFAULT_BOTTOM_ANCHOR
}

function getClientY(event: DragPoint): number | null {
  if ('touches' in event) {
    const touch = event.touches[0] || event.changedTouches[0]
    return touch ? touch.clientY : null
  }

  return event.clientY
}

function rectsOverlap(a: DOMRect, b: DOMRect, padding = 0): boolean {
  return !(
    a.right < b.left - padding ||
    a.left > b.right + padding ||
    a.bottom < b.top - padding ||
    a.top > b.bottom + padding
  )
}

function safeNameHint(el: HTMLElement): string {
  return [
    el.id,
    el.className?.toString?.() || '',
    el.getAttribute('data-component') || '',
    el.getAttribute('data-part') || '',
    el.getAttribute('data-testid') || '',
    el.getAttribute('aria-label') || '',
  ]
    .join(' ')
    .toLowerCase()
}

function hasOpenPopover(el: HTMLElement): boolean {
  if (!el.hasAttribute('popover')) return false

  try {
    if (el.matches(':popover-open')) return true
  } catch {
    // Some WebViews do not support :popover-open yet.
  }

  return isVisibleElement(el)
}

function isPotentialBlockingUi(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  const role = (el.getAttribute('role') || '').toLowerCase()
  const nameHint = safeNameHint(el)
  const position = style.position
  const zIndex = Number.parseInt(style.zIndex, 10)

  const floating = position === 'fixed' || position === 'absolute' || position === 'sticky'
  const hasUsefulZIndex = Number.isFinite(zIndex) && zIndex >= RULER_Z_INDEX
  const hasOverlayName =
    /modal|dialog|drawer|sheet|sidebar|side-bar|popover|popper|dropdown|menu|select|portal|floating|tooltip|overlay|command|cmdk|palette|toast/i.test(
      nameHint,
    )
  const hasOverlayRole = /dialog|menu|listbox|tooltip|tree|grid/.test(role)
  const isLargePanel = rect.width > viewportWidth() * 0.45 && rect.height > viewportHeight() * 0.28
  const isBottomUi = rect.bottom > viewportHeight() * 0.55 && rect.width > viewportWidth() * 0.35 && rect.height > 44

  return (
    el.getAttribute('aria-modal') === 'true' ||
    hasOpenPopover(el) ||
    (hasOverlayName && (floating || hasUsefulZIndex || isLargePanel || isBottomUi)) ||
    (hasOverlayRole && (floating || hasUsefulZIndex || isBottomUi))
  )
}

function queryPotentialBlockingElements(): HTMLElement[] {
  const selectors = [
    '[role="dialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="tooltip"]',
    '[aria-modal="true"]',
    '[popover]',
    '[data-radix-popper-content-wrapper]',
    '[data-radix-portal]',
    '[data-floating-ui-portal]',
    '[data-headlessui-portal]',
    '[data-state="open"]',
    '[class*="modal"]',
    '[class*="dialog"]',
    '[class*="drawer"]',
    '[class*="sheet"]',
    '[class*="sidebar"]',
    '[class*="popover"]',
    '[class*="popper"]',
    '[class*="dropdown"]',
    '[class*="menu"]',
    '[class*="portal"]',
    '[class*="overlay"]',
  ]

  try {
    return Array.from(document.querySelectorAll(selectors.join(','))).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    )
  } catch {
    return []
  }
}

function shouldYieldToAppUi(ruler: HTMLElement, inputAnchor: HTMLElement): boolean {
  const rulerRect = ruler.getBoundingClientRect()
  const handleRect = ruler.querySelector('.reading-ruler-handle')?.getBoundingClientRect() || rulerRect

  for (const el of queryPotentialBlockingElements()) {
    if (el === ruler || ruler.contains(el)) continue
    if (el === inputAnchor) continue
    if (!isVisibleElement(el)) continue
    if (!isPotentialBlockingUi(el)) continue

    const rect = el.getBoundingClientRect()
    const hugeOverlay = rect.width > viewportWidth() * 0.72 && rect.height > viewportHeight() * 0.45
    const intersectsRuler = rectsOverlap(rect, rulerRect, 10) || rectsOverlap(rect, handleRect, 16)
    const bottomPopover =
      rect.bottom > viewportHeight() * 0.52 && rect.width > viewportWidth() * 0.35 && rect.height > 48

    if (hugeOverlay || intersectsRuler || bottomPopover) return true
  }

  return false
}

export function setup(ctx: SpindleFrontendContext) {
  const win = window as CleanupWindow
  win[GLOBAL_CLEANUP_KEY]?.()

  const initialAnchor = findInputAnchor()
  const initialBottom = computeBottomAnchor(initialAnchor)
  const initialHeight = clampHeight(readSavedHeight() ?? DEFAULT_HEIGHT, initialBottom)

  const removeStyle = ctx.dom.addStyle(`
    #${ROOT_ID} {
      position: fixed;
      inset-inline: 10px;
      bottom: ${initialBottom}px;
      height: ${initialHeight}px;
      z-index: ${RULER_Z_INDEX};
      display: none;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      opacity: 0;
      transform: translateY(10px);
      transition:
        opacity 140ms ease,
        transform 140ms ease;

      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.035)),
        linear-gradient(180deg, rgba(40, 38, 52, 0.58), rgba(8, 8, 12, 0.64));
      backdrop-filter: blur(12px) saturate(118%);
      -webkit-backdrop-filter: blur(12px) saturate(118%);

      border-top: 1px solid rgba(245, 239, 255, 0.22);
      border-inline: 1px solid rgba(235, 226, 255, 0.10);
      border-bottom: 1px solid rgba(0, 0, 0, 0.20);
      border-radius: 12px 12px 0 0;
      box-shadow:
        0 -10px 28px rgba(0, 0, 0, 0.30),
        inset 0 1px 0 rgba(255, 255, 255, 0.09),
        inset 0 -1px 0 rgba(0, 0, 0, 0.30);
      overflow: visible;
    }

    #${ROOT_ID}[data-active="true"] {
      display: block;
      opacity: 0.90;
      transform: translateY(0);
    }

    #${ROOT_ID}[data-dragging="true"] {
      opacity: 0.98;
      transition: none;
    }

    #${ROOT_ID}::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background:
        repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.034) 0 1px, transparent 1px 12px),
        linear-gradient(90deg, transparent, rgba(230, 218, 255, 0.075), transparent);
      opacity: 0.62;
    }

    #${ROOT_ID}::after {
      content: '';
      position: absolute;
      inset-inline: 8%;
      top: 0;
      height: 1px;
      pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(245, 239, 255, 0.62), transparent);
      box-shadow: 0 1px 8px rgba(205, 194, 255, 0.22);
    }

    #${ROOT_ID} .reading-ruler-handle {
      position: absolute;
      left: 0;
      right: 0;
      top: -32px;
      height: 58px;
      border: 0;
      margin: 0;
      padding: 0;
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
      top: 17px;
      width: min(172px, 38vw);
      height: 8px;
      transform: translateX(-50%);
      border-radius: 999px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(210, 204, 230, 0.36));
      border: 1px solid rgba(255, 255, 255, 0.42);
      box-shadow:
        0 4px 13px rgba(0, 0, 0, 0.58),
        inset 0 1px 0 rgba(255, 255, 255, 0.62);
    }

    #${ROOT_ID}[data-dragging="true"] .reading-ruler-handle::before {
      filter: brightness(1.14);
    }
  `)

  const wrapper = ctx.dom.inject(
    'body',
    `<div id="${ROOT_ID}" aria-label="Expandable reading ruler"><button class="reading-ruler-handle" type="button" aria-label="Drag to resize reading ruler"></button></div>`,
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
  let startHeight = 0
  let lastBottomAnchor = initialBottom
  let syncFrame = 0

  const applyHeight = (nextHeight: number, persist = true) => {
    const clamped = clampHeight(nextHeight, lastBottomAnchor)
    ruler.style.height = `${clamped}px`
    if (persist) saveHeight(clamped)
  }

  const applyBottomAnchor = (nextBottom: number) => {
    lastBottomAnchor = nextBottom
    ruler.style.bottom = `${nextBottom}px`
    const currentHeight = Number.parseFloat(window.getComputedStyle(ruler).height)
    applyHeight(Number.isFinite(currentHeight) ? currentHeight : initialHeight, false)
  }

  const syncVisibility = () => {
    const inputAnchor = findInputAnchor()
    const activeChat = isChatRoute() && inputAnchor !== null

    if (!activeChat || !inputAnchor) {
      ruler.dataset.active = 'false'
      return
    }

    if (!dragging) {
      applyBottomAnchor(computeBottomAnchor(inputAnchor))
      const saved = readSavedHeight()
      if (saved !== null) applyHeight(saved, false)
    }

    const blockedByUi = !dragging && shouldYieldToAppUi(ruler, inputAnchor)
    ruler.dataset.active = blockedByUi ? 'false' : 'true'
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
    startHeight = ruler.getBoundingClientRect().height || initialHeight

    if ('pointerId' in event) {
      activePointerId = event.pointerId
      try {
        handle.setPointerCapture(event.pointerId)
      } catch {
        // Window listeners below still handle drag in cranky mobile webviews.
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
    applyHeight(startHeight + delta)
    event.preventDefault()
  }

  const endDrag = (event?: DragPoint) => {
    if ('pointerId' in (event || {}) && activePointerId !== null && (event as PointerEvent).pointerId !== activePointerId) return

    if (event && 'pointerId' in event) {
      try {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore pointer-capture cleanup failures.
      }
    }

    dragging = false
    activePointerId = null
    ruler.dataset.dragging = 'false'
    scheduleSync()
  }

  const onResize = () => {
    const inputAnchor = findInputAnchor()
    applyBottomAnchor(computeBottomAnchor(inputAnchor))
    const saved = readSavedHeight()
    applyHeight(saved ?? DEFAULT_HEIGHT, false)
    scheduleSync()
  }

  const observer = new MutationObserver(scheduleSync)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-state', 'aria-hidden', 'aria-modal', 'popover'] })

  const supportsPointer = 'PointerEvent' in window

  if (supportsPointer) {
    handle.addEventListener('pointerdown', beginDrag as EventListener, { passive: false })
    window.addEventListener('pointermove', continueDrag as EventListener, { passive: false })
    window.addEventListener('pointerup', endDrag as EventListener, { passive: false })
    window.addEventListener('pointercancel', endDrag as EventListener, { passive: false })
  } else {
    handle.addEventListener('mousedown', beginDrag as EventListener, { passive: false })
    window.addEventListener('mousemove', continueDrag as EventListener, { passive: false })
    window.addEventListener('mouseup', endDrag as EventListener, { passive: false })

    handle.addEventListener('touchstart', beginDrag as EventListener, { passive: false })
    window.addEventListener('touchmove', continueDrag as EventListener, { passive: false })
    window.addEventListener('touchend', endDrag as EventListener, { passive: false })
    window.addEventListener('touchcancel', endDrag as EventListener, { passive: false })
  }

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

    if (supportsPointer) {
      handle.removeEventListener('pointerdown', beginDrag as EventListener)
      window.removeEventListener('pointermove', continueDrag as EventListener)
      window.removeEventListener('pointerup', endDrag as EventListener)
      window.removeEventListener('pointercancel', endDrag as EventListener)
    } else {
      handle.removeEventListener('mousedown', beginDrag as EventListener)
      window.removeEventListener('mousemove', continueDrag as EventListener)
      window.removeEventListener('mouseup', endDrag as EventListener)

      handle.removeEventListener('touchstart', beginDrag as EventListener)
      window.removeEventListener('touchmove', continueDrag as EventListener)
      window.removeEventListener('touchend', endDrag as EventListener)
      window.removeEventListener('touchcancel', endDrag as EventListener)
    }

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
