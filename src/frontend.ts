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
const SIDE_INSET = 10
const SIDE_PANEL_GAP = 8

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

function readCssNumber(name: string, fallback: number, el?: HTMLElement | null): number {
  const sources: Element[] = []
  if (el) sources.push(el)
  sources.push(document.documentElement)

  for (const source of sources) {
    const raw = window.getComputedStyle(source).getPropertyValue(name).trim()
    if (!raw) continue

    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed)) return parsed
  }

  return fallback
}

function minHeight(ruler?: HTMLElement | null): number {
  return readCssNumber('--lrr-min-height', MIN_HEIGHT, ruler)
}

function topMargin(ruler?: HTMLElement | null): number {
  return readCssNumber('--lrr-top-margin', TOP_MARGIN, ruler)
}

function sideInset(ruler?: HTMLElement | null): number {
  return readCssNumber('--lrr-side-inset', SIDE_INSET, ruler)
}

function sidePanelGap(ruler?: HTMLElement | null): number {
  return readCssNumber('--lrr-side-panel-gap', SIDE_PANEL_GAP, ruler)
}

function zIndexThreshold(): number {
  return readCssNumber('--lrr-z-index', RULER_Z_INDEX)
}

function readSavedHeight(): number | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

function saveHeight(value: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)))
}

function clampHeight(value: number, bottomAnchor: number, ruler?: HTMLElement | null): number {
  const min = minHeight(ruler)
  const maxHeight = Math.max(min, viewportHeight() - bottomAnchor - topMargin(ruler))
  return Math.max(min, Math.min(maxHeight, value))
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
  const hasUsefulZIndex = Number.isFinite(zIndex) && zIndex >= zIndexThreshold()
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
    '[class*="modal" i]',
    '[class*="dialog" i]',
    '[class*="drawer" i]',
    '[class*="sheet" i]',
    '[class*="sidebar" i]',
    '[class*="side-bar" i]',
    '[class*="popover" i]',
    '[class*="popper" i]',
    '[class*="dropdown" i]',
    '[class*="menu" i]',
    '[class*="portal" i]',
    '[class*="overlay" i]',
  ]

  try {
    return Array.from(document.querySelectorAll(selectors.join(','))).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    )
  } catch {
    return []
  }
}

function isProbablyEdgePanel(
  el: HTMLElement,
  side: 'left' | 'right',
  ruler: HTMLElement,
  inputAnchor: HTMLElement,
): boolean {
  if (el === ruler || ruler.contains(el)) return false
  if (el === inputAnchor || inputAnchor.contains(el) || el.contains(inputAnchor)) return false
  if (el === document.body || el === document.documentElement) return false
  if (!isVisibleElement(el)) return false

  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  const nameHint = safeNameHint(el)
  const role = (el.getAttribute('role') || '').toLowerCase()
  const position = style.position
  const zIndex = Number.parseInt(style.zIndex, 10)

  const touchesEdge = side === 'right' ? rect.right >= viewportWidth() - 4 : rect.left <= 4
  const substantialWidth = rect.width >= 42
  const substantialHeight = rect.height >= Math.min(160, viewportHeight() * 0.22)
  const floating = position === 'fixed' || position === 'absolute' || position === 'sticky'
  const highZ = Number.isFinite(zIndex) && zIndex >= zIndexThreshold()
  const namedLikePanel =
    /sidebar|side-bar|dock|drawer|sheet|panel|rail|nav|navigation|settings|extension|profile|loom|weaver|connect|browser|chars|character|persona|lore|memory|data/i.test(
      nameHint,
    )
  const roleLikePanel = /dialog|navigation|complementary/.test(role)
  const fullHeightRail = rect.height > viewportHeight() * 0.64

  return (
    touchesEdge &&
    substantialWidth &&
    substantialHeight &&
    (floating || highZ || namedLikePanel || roleLikePanel || fullHeightRail)
  )
}

function edgePanelInsets(
  ruler: HTMLElement,
  inputAnchor: HTMLElement,
  bottomAnchor: number,
): { left: number; right: number } {
  const height =
    Number.parseFloat(ruler.style.height) ||
    ruler.getBoundingClientRect().height ||
    readSavedHeight() ||
    DEFAULT_HEIGHT
  const top = Math.max(0, viewportHeight() - bottomAnchor - height)
  const bottom = Math.min(viewportHeight(), viewportHeight() - bottomAnchor)
  const samples = [
    top + 18,
    top + Math.max(26, (bottom - top) * 0.42),
    Math.max(top + 18, bottom - 18),
    viewportHeight() * 0.5,
  ]
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(1, Math.min(viewportHeight() - 1, value)))

  const gap = sidePanelGap(ruler)
  let left = 0
  let right = 0

  for (const y of samples) {
    for (const side of ['left', 'right'] as const) {
      const x = side === 'right' ? viewportWidth() - 2 : 2
      const elements = document.elementsFromPoint(x, y)

      for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue
        if (!isProbablyEdgePanel(element, side, ruler, inputAnchor)) continue

        const rect = element.getBoundingClientRect()
        if (side === 'right') {
          right = Math.max(right, viewportWidth() - rect.left + gap)
        } else {
          left = Math.max(left, rect.right + gap)
        }
      }
    }
  }

  return { left, right }
}

function horizontalInsets(
  ruler: HTMLElement,
  inputAnchor: HTMLElement,
  bottomAnchor: number,
): { left: number; right: number } {
  const rect = inputAnchor.getBoundingClientRect()
  const baseInset = sideInset(ruler)
  let left = baseInset
  let right = baseInset

  if (rect.width >= viewportWidth() * 0.38 && rect.height >= 28) {
    left = Math.max(left, Math.floor(rect.left))
    right = Math.max(right, Math.floor(viewportWidth() - rect.right))
  }

  const edgeInsets = edgePanelInsets(ruler, inputAnchor, bottomAnchor)
  left = Math.max(left, edgeInsets.left)
  right = Math.max(right, edgeInsets.right)

  return { left: Math.round(left), right: Math.round(right) }
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
  const initialHeight = clampHeight(
    readSavedHeight() ?? readCssNumber('--lrr-default-height', DEFAULT_HEIGHT),
    initialBottom,
  )

  const removeStyle = ctx.dom.addStyle(`
    #${ROOT_ID} {
      position: fixed;
      left: var(--lrr-runtime-left, var(--lrr-side-inset, 10px));
      right: var(--lrr-runtime-right, var(--lrr-side-inset, 10px));
      bottom: ${initialBottom}px;
      height: ${initialHeight}px;
      z-index: var(--lrr-z-index, ${RULER_Z_INDEX});
      display: none;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      opacity: 0;
      transform: translateY(10px);
      transition:
        opacity 140ms ease,
        transform 140ms ease;

      background: var(--lrr-background,
        linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.035)),
        linear-gradient(180deg, rgba(40, 38, 52, 0.58), rgba(8, 8, 12, 0.64))
      );
      backdrop-filter: blur(var(--lrr-blur, 12px)) saturate(var(--lrr-saturate, 118%));
      -webkit-backdrop-filter: blur(var(--lrr-blur, 12px)) saturate(var(--lrr-saturate, 118%));

      border-top: var(--lrr-border-top, 1px solid rgba(245, 239, 255, 0.22));
      border-inline: var(--lrr-border-inline, 1px solid rgba(235, 226, 255, 0.10));
      border-bottom: var(--lrr-border-bottom, 1px solid rgba(0, 0, 0, 0.20));
      border-radius: var(--lrr-radius, 12px 12px 0 0);
      box-shadow: var(--lrr-shadow,
        0 -10px 28px rgba(0, 0, 0, 0.30),
        inset 0 1px 0 rgba(255, 255, 255, 0.09),
        inset 0 -1px 0 rgba(0, 0, 0, 0.30)
      );
      overflow: visible;
    }

    #${ROOT_ID}[data-active="true"] {
      display: block;
      opacity: var(--lrr-opacity, 0.90);
      transform: translateY(0);
    }

    #${ROOT_ID}[data-dragging="true"] {
      opacity: var(--lrr-drag-opacity, 0.98);
      transition: none;
    }

    #${ROOT_ID}::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background: var(--lrr-texture,
        repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.034) 0 1px, transparent 1px var(--lrr-line-gap, 12px)),
        linear-gradient(90deg, transparent, rgba(230, 218, 255, 0.075), transparent)
      );
      opacity: var(--lrr-texture-opacity, 0.62);
    }

    #${ROOT_ID}::after {
      content: '';
      position: absolute;
      inset-inline: 8%;
      top: 0;
      height: 1px;
      pointer-events: none;
      background: var(--lrr-highlight, linear-gradient(90deg, transparent, rgba(245, 239, 255, 0.62), transparent));
      box-shadow: var(--lrr-highlight-shadow, 0 1px 8px rgba(205, 194, 255, 0.22));
    }

    #${ROOT_ID} .reading-ruler-handle {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(var(--lrr-handle-hit-top, -32px));
      height: var(--lrr-handle-hit-height, 58px);
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
      top: var(--lrr-handle-top, 17px);
      width: min(var(--lrr-handle-width, 172px), 38vw);
      height: var(--lrr-handle-height, 8px);
      transform: translateX(-50%);
      border-radius: var(--lrr-handle-radius, 999px);
      background: var(--lrr-handle-background,
        linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(210, 204, 230, 0.36))
      );
      border: var(--lrr-handle-border, 1px solid rgba(255, 255, 255, 0.42));
      box-shadow: var(--lrr-handle-shadow,
        0 4px 13px rgba(0, 0, 0, 0.58),
        inset 0 1px 0 rgba(255, 255, 255, 0.62)
      );
    }

    #${ROOT_ID}[data-dragging="true"] .reading-ruler-handle::before {
      filter: var(--lrr-handle-drag-filter, brightness(1.14));
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
    const clamped = clampHeight(nextHeight, lastBottomAnchor, ruler)
    ruler.style.height = `${clamped}px`
    if (persist) saveHeight(clamped)
  }

  const applyHorizontalInsets = (inputAnchor: HTMLElement) => {
    const insets = horizontalInsets(ruler, inputAnchor, lastBottomAnchor)
    ruler.style.setProperty('--lrr-runtime-left', `${insets.left}px`)
    ruler.style.setProperty('--lrr-runtime-right', `${insets.right}px`)
  }

  const applyBottomAnchor = (nextBottom: number, inputAnchor?: HTMLElement | null) => {
    lastBottomAnchor = nextBottom
    ruler.style.bottom = `${nextBottom}px`
    if (inputAnchor) applyHorizontalInsets(inputAnchor)
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
      applyBottomAnchor(computeBottomAnchor(inputAnchor), inputAnchor)
      const saved = readSavedHeight()
      if (saved !== null) applyHeight(saved, false)
    }

    applyHorizontalInsets(inputAnchor)

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
    applyBottomAnchor(computeBottomAnchor(inputAnchor), inputAnchor)
    const saved = readSavedHeight()
    applyHeight(saved ?? readCssNumber('--lrr-default-height', DEFAULT_HEIGHT, ruler), false)
    scheduleSync()
  }

  const observer = new MutationObserver(scheduleSync)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-state', 'aria-hidden', 'aria-modal', 'popover'],
  })

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
