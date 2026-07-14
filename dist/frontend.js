const ROOT_ID = "lumi-reading-ruler";
const STORAGE_KEY = "lumi-reading-ruler-bottom";
const DEFAULT_BOTTOM = 92;
const MIN_BOTTOM = 20;
const TOP_MARGIN = 28;
const RULER_HEIGHT = 92;
function readSavedBottom() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_BOTTOM;
}
function clampBottom(value) {
  const maxBottom = Math.max(MIN_BOTTOM, window.innerHeight - RULER_HEIGHT - TOP_MARGIN);
  return Math.max(MIN_BOTTOM, Math.min(maxBottom, value));
}
function saveBottom(value) {
  window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
}
export function setup(ctx) {
  const existing = document.getElementById(ROOT_ID);
  if (existing)
    existing.remove();
  const removeStyle = ctx.dom.addStyle(`
    #${ROOT_ID} {
      position: fixed;
      inset-inline: 0;
      bottom: ${clampBottom(readSavedBottom())}px;
      height: ${RULER_HEIGHT}px;
      z-index: 2147483000;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      opacity: 0.96;

      background:
        radial-gradient(circle at 10% 18%, rgba(255, 255, 255, 0.18), transparent 28%),
        linear-gradient(180deg, rgba(235, 226, 255, 0.13), rgba(13, 12, 18, 0.58));
      backdrop-filter: blur(15px) saturate(125%);
      -webkit-backdrop-filter: blur(15px) saturate(125%);

      border-block: 1px solid rgba(235, 226, 255, 0.18);
      box-shadow:
        0 -18px 42px rgba(0, 0, 0, 0.44),
        0 18px 42px rgba(0, 0, 0, 0.44),
        inset 0 1px 0 rgba(255, 255, 255, 0.10),
        inset 0 -1px 0 rgba(0, 0, 0, 0.42);

      mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
      -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
    }

    #${ROOT_ID}::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.055), transparent),
        repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 14px);
      mix-blend-mode: screen;
      opacity: 0.42;
    }

    #${ROOT_ID}::after {
      content: '';
      position: absolute;
      inset-inline: 8%;
      top: 50%;
      height: 1px;
      pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(225, 213, 255, 0.34), transparent);
      transform: translateY(-50%);
    }

    #${ROOT_ID} .reading-ruler-handle {
      position: absolute;
      left: 50%;
      top: -11px;
      transform: translateX(-50%);
      width: min(178px, 34vw);
      height: 9px;
      border-radius: 999px;
      pointer-events: auto;
      touch-action: none;
      cursor: ns-resize;

      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(218, 210, 240, 0.36));
      border: 1px solid rgba(255, 255, 255, 0.38);
      box-shadow:
        0 4px 14px rgba(0, 0, 0, 0.58),
        inset 0 1px 0 rgba(255, 255, 255, 0.62);
    }

    #${ROOT_ID} .reading-ruler-handle:active {
      cursor: grabbing;
      filter: brightness(1.08);
    }
  `);
  const wrapper = ctx.dom.inject(
    "body",
    `
      <div id="${ROOT_ID}" aria-label="Draggable reading ruler">
        <div class="reading-ruler-handle" aria-hidden="true"></div>
      </div>
    `,
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
  let startBottom = 0;
  const applyBottom = (nextBottom, persist = true) => {
    const clamped = clampBottom(nextBottom);
    ruler.style.bottom = `${clamped}px`;
    if (persist)
      saveBottom(clamped);
  };
  applyBottom(readSavedBottom(), false);
  const onPointerDown = (event) => {
    dragging = true;
    activePointerId = event.pointerId;
    startY = event.clientY;
    startBottom = Number.parseFloat(window.getComputedStyle(ruler).bottom) || DEFAULT_BOTTOM;
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event) => {
    if (!dragging || event.pointerId !== activePointerId)
      return;
    const delta = startY - event.clientY;
    applyBottom(startBottom + delta);
    event.preventDefault();
  };
  const stopDragging = (event) => {
    if (event && activePointerId !== event.pointerId)
      return;
    if (event && handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    dragging = false;
    activePointerId = null;
  };
  const onResize = () => {
    const current = Number.parseFloat(window.getComputedStyle(ruler).bottom) || DEFAULT_BOTTOM;
    applyBottom(current);
  };
  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", stopDragging);
  handle.addEventListener("pointercancel", stopDragging);
  handle.addEventListener("lostpointercapture", () => {
    dragging = false;
    activePointerId = null;
  });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  return () => {
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", stopDragging);
    handle.removeEventListener("pointercancel", stopDragging);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    removeStyle();
    ctx.dom.uninject(wrapper);
    ctx.dom.cleanup();
  };
}
