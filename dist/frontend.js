const ROOT_ID = "lumi-reading-ruler";
const STORAGE_KEY = "lumi-reading-ruler-v3-height";
const GLOBAL_CLEANUP_KEY = "__lumiReadingRulerCleanup";
const DEFAULT_HEIGHT = 84;
const MIN_HEIGHT = 38;
const TOP_MARGIN = 34;
const DEFAULT_BOTTOM_ANCHOR = 118;
const INPUT_GAP = 8;
function viewportHeight() {
  return window.innerHeight || document.documentElement.clientHeight || 720;
}
function readSavedHeight() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
function saveHeight(value) {
  window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
}
function clampHeight(value, bottomAnchor) {
  const maxHeight = Math.max(MIN_HEIGHT, viewportHeight() - bottomAnchor - TOP_MARGIN);
  return Math.max(MIN_HEIGHT, Math.min(maxHeight, value));
}
function isVisibleElement(el) {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight() && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}
function isChatRoute() {
  return /(?:^|\/)chat\/[^/]+/.test(window.location.pathname);
}
function findInputAnchor() {
  const candidates = Array.from(
    document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')
  ).filter(isVisibleElement);
  const lowerCandidates = candidates.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top > viewportHeight() * 0.45;
  });
  for (const candidate of lowerCandidates) {
    let best = candidate;
    let node = candidate;
    while (node && node !== document.body && node !== document.documentElement) {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const className = node.className.toString();
      const id = node.id || "";
      const nameHint = `${className} ${id}`;
      const isLikelyInputShell = rect.width >= window.innerWidth * 0.5 && rect.height >= 34 && rect.height <= Math.min(280, viewportHeight() * 0.38) && rect.bottom >= viewportHeight() * 0.62 && (style.position === "fixed" || style.position === "absolute" || style.position === "sticky" || /input|composer|message|textarea|prompt|bar|bottom|container/i.test(nameHint));
      if (isLikelyInputShell) best = node;
      node = node.parentElement;
    }
    if (best) return best;
  }
  return null;
}
function computeBottomAnchor() {
  const anchor = findInputAnchor();
  if (!anchor) return DEFAULT_BOTTOM_ANCHOR;
  const rect = anchor.getBoundingClientRect();
  const bottom = viewportHeight() - rect.top + INPUT_GAP;
  return Number.isFinite(bottom) ? Math.max(0, bottom) : DEFAULT_BOTTOM_ANCHOR;
}
function getClientY(event) {
  if ("touches" in event) {
    const touch = event.touches[0] || event.changedTouches[0];
    return touch ? touch.clientY : null;
  }
  return event.clientY;
}
function setup(ctx) {
  const win = window;
  win[GLOBAL_CLEANUP_KEY]?.();
  const initialBottom = computeBottomAnchor();
  const initialHeight = clampHeight(readSavedHeight() ?? DEFAULT_HEIGHT, initialBottom);
  const removeStyle = ctx.dom.addStyle(`
    #${ROOT_ID} {
      position: fixed;
      inset-inline: 10px;
      bottom: ${initialBottom}px;
      height: ${initialHeight}px;
      z-index: 2147483000;
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
  `);
  const wrapper = ctx.dom.inject(
    "body",
    `<div id="${ROOT_ID}" aria-label="Expandable reading ruler"><button class="reading-ruler-handle" type="button" aria-label="Drag to resize reading ruler"></button></div>`,
    "beforeend"
  );
  const ruler = document.getElementById(ROOT_ID);
  const handle = ruler?.querySelector(".reading-ruler-handle");
  if (!ruler || !handle) {
    removeStyle();
    ctx.dom.uninject(wrapper);
    return () => void 0;
  }
  let dragging = false;
  let activePointerId = null;
  let startY = 0;
  let startHeight = 0;
  let lastBottomAnchor = initialBottom;
  let syncFrame = 0;
  const applyHeight = (nextHeight, persist = true) => {
    const clamped = clampHeight(nextHeight, lastBottomAnchor);
    ruler.style.height = `${clamped}px`;
    if (persist) saveHeight(clamped);
  };
  const applyBottomAnchor = (nextBottom) => {
    lastBottomAnchor = nextBottom;
    ruler.style.bottom = `${nextBottom}px`;
    const currentHeight = Number.parseFloat(window.getComputedStyle(ruler).height);
    applyHeight(Number.isFinite(currentHeight) ? currentHeight : initialHeight, false);
  };
  const syncVisibility = () => {
    const active = isChatRoute();
    ruler.dataset.active = active ? "true" : "false";
    if (!active || dragging) return;
    applyBottomAnchor(computeBottomAnchor());
    const saved = readSavedHeight();
    if (saved !== null) applyHeight(saved, false);
  };
  const scheduleSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncVisibility);
  };
  const beginDrag = (event) => {
    const clientY = getClientY(event);
    if (clientY === null) return;
    dragging = true;
    ruler.dataset.dragging = "true";
    startY = clientY;
    startHeight = ruler.getBoundingClientRect().height || initialHeight;
    if ("pointerId" in event) {
      activePointerId = event.pointerId;
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
      }
    }
    event.preventDefault();
  };
  const continueDrag = (event) => {
    if (!dragging) return;
    if ("pointerId" in event && activePointerId !== null && event.pointerId !== activePointerId) return;
    const clientY = getClientY(event);
    if (clientY === null) return;
    const delta = startY - clientY;
    applyHeight(startHeight + delta);
    event.preventDefault();
  };
  const endDrag = (event) => {
    if ("pointerId" in (event || {}) && activePointerId !== null && event.pointerId !== activePointerId) return;
    if (event && "pointerId" in event) {
      try {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      } catch {
      }
    }
    dragging = false;
    activePointerId = null;
    ruler.dataset.dragging = "false";
  };
  const onResize = () => {
    applyBottomAnchor(computeBottomAnchor());
    const saved = readSavedHeight();
    applyHeight(saved ?? DEFAULT_HEIGHT, false);
    scheduleSync();
  };
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  const supportsPointer = "PointerEvent" in window;
  if (supportsPointer) {
    handle.addEventListener("pointerdown", beginDrag, { passive: false });
    window.addEventListener("pointermove", continueDrag, { passive: false });
    window.addEventListener("pointerup", endDrag, { passive: false });
    window.addEventListener("pointercancel", endDrag, { passive: false });
  } else {
    handle.addEventListener("mousedown", beginDrag, { passive: false });
    window.addEventListener("mousemove", continueDrag, { passive: false });
    window.addEventListener("mouseup", endDrag, { passive: false });
    handle.addEventListener("touchstart", beginDrag, { passive: false });
    window.addEventListener("touchmove", continueDrag, { passive: false });
    window.addEventListener("touchend", endDrag, { passive: false });
    window.addEventListener("touchcancel", endDrag, { passive: false });
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("hashchange", scheduleSync);
  const interval = window.setInterval(syncVisibility, 500);
  syncVisibility();
  const cleanup = () => {
    cancelAnimationFrame(syncFrame);
    window.clearInterval(interval);
    observer.disconnect();
    if (supportsPointer) {
      handle.removeEventListener("pointerdown", beginDrag);
      window.removeEventListener("pointermove", continueDrag);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    } else {
      handle.removeEventListener("mousedown", beginDrag);
      window.removeEventListener("mousemove", continueDrag);
      window.removeEventListener("mouseup", endDrag);
      handle.removeEventListener("touchstart", beginDrag);
      window.removeEventListener("touchmove", continueDrag);
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("touchcancel", endDrag);
    }
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    window.removeEventListener("popstate", scheduleSync);
    window.removeEventListener("hashchange", scheduleSync);
    removeStyle();
    ctx.dom.uninject(wrapper);
    ctx.dom.cleanup();
    if (win[GLOBAL_CLEANUP_KEY] === cleanup) delete win[GLOBAL_CLEANUP_KEY];
  };
  win[GLOBAL_CLEANUP_KEY] = cleanup;
  return cleanup;
}
export {
  setup
};
