const ROOT_ID = 'lumi-reading-ruler';
const TOGGLE_ID = 'lumi-reading-ruler-toggle';
const STORAGE_KEY = 'lumi-reading-ruler-v3-height';
const STORAGE_MOBILE_ENABLED_KEY = 'lumi-reading-ruler-mobile-enabled';
const GLOBAL_CLEANUP_KEY = '__lumiReadingRulerCleanup';
const DEFAULT_HEIGHT = 84;
const MIN_HEIGHT = 38;
const TOP_MARGIN = 34;
const DEFAULT_BOTTOM_ANCHOR = 118;
const INPUT_GAP = 8;
const RULER_Z_INDEX = 24;
const SIDE_INSET = 10;
const SIDE_PANEL_GAP = 8;
const MIN_RULER_WIDTH = 180;
const MAX_EDGE_PANEL_WIDTH = 680;
const MOBILE_BREAKPOINT = 760;
const MOBILE_YIELD_UI = 0;
const MOBILE_TOGGLE_ENABLED = 1;
function viewportHeight() {
    return window.innerHeight || document.documentElement.clientHeight || 720;
}
function viewportWidth() {
    return window.innerWidth || document.documentElement.clientWidth || 390;
}
function readCssNumber(name, fallback, el) {
    const sources = [];
    if (el)
        sources.push(el);
    sources.push(document.documentElement);
    for (const source of sources) {
        const raw = window.getComputedStyle(source).getPropertyValue(name).trim();
        if (!raw)
            continue;
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return fallback;
}
function minHeight(ruler) {
    return readCssNumber('--lrr-min-height', MIN_HEIGHT, ruler);
}
function topMargin(ruler) {
    return readCssNumber('--lrr-top-margin', TOP_MARGIN, ruler);
}
function sideInset(ruler) {
    return readCssNumber('--lrr-side-inset', SIDE_INSET, ruler);
}
function sidePanelGap(ruler) {
    return readCssNumber('--lrr-side-panel-gap', SIDE_PANEL_GAP, ruler);
}
function minRulerWidth(ruler) {
    return readCssNumber('--lrr-min-width', MIN_RULER_WIDTH, ruler);
}
function maxEdgePanelWidth(ruler) {
    const cssValue = readCssNumber('--lrr-max-edge-panel-width', Number.NaN, ruler);
    const defaultValue = Math.min(MAX_EDGE_PANEL_WIDTH, viewportWidth() * 0.48);
    return Number.isFinite(cssValue) ? cssValue : defaultValue;
}
function zIndexThreshold() {
    return readCssNumber('--lrr-z-index', RULER_Z_INDEX);
}
function mobileBreakpoint(ruler) {
    return readCssNumber('--lrr-mobile-breakpoint', MOBILE_BREAKPOINT, ruler);
}
function mobileYieldUi(ruler) {
    return readCssNumber('--lrr-mobile-yield-ui', MOBILE_YIELD_UI, ruler) >= 0.5;
}
function mobileToggleAllowed(ruler) {
    return readCssNumber('--lrr-mobile-toggle-enabled', MOBILE_TOGGLE_ENABLED, ruler) >= 0.5;
}
function readMobileEnabled() {
    const raw = window.localStorage.getItem(STORAGE_MOBILE_ENABLED_KEY);
    if (raw === null)
        return true;
    return raw !== '0' && raw !== 'false';
}
function saveMobileEnabled(value) {
    window.localStorage.setItem(STORAGE_MOBILE_ENABLED_KEY, value ? '1' : '0');
}
function isMobileViewport(ruler) {
    return viewportWidth() <= mobileBreakpoint(ruler);
}
function readSavedHeight() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
}
function saveHeight(value) {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(value)));
}
function clampHeight(value, bottomAnchor, ruler) {
    const min = minHeight(ruler);
    const maxHeight = Math.max(min, viewportHeight() - bottomAnchor - topMargin(ruler));
    return Math.max(min, Math.min(maxHeight, value));
}
function isVisibleElement(el) {
    if (!(el instanceof HTMLElement))
        return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < viewportHeight() &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0');
}
function isChatRoute() {
    const routeText = [
        window.location.pathname,
        window.location.hash,
        window.location.search,
        window.location.href,
    ]
        .join(' ')
        .toLowerCase();
    return /(?:^|[#/?&])chats?(?:\/|%2f)[^\s?#&]+/.test(routeText);
}
function looksLikeMobileChatScreen() {
    if (!isMobileViewport())
        return false;
    const routeText = [window.location.pathname, window.location.hash, window.location.search, window.location.href]
        .join(' ')
        .toLowerCase();
    if (/chat|conversation|thread/.test(routeText))
        return true;
    if (document.querySelector('[data-component="InputArea"]'))
        return true;
    if (document.querySelector('[placeholder*="message" i], [aria-label*="message" i]'))
        return true;
    const bodyText = document.body?.innerText || '';
    return /type a message|send message|regenerate|continue|greetings/i.test(bodyText);
}
function findInputShellCandidates() {
    const selectors = [
        '[data-component="InputArea"]',
        '[data-testid*="input" i]',
        '[data-testid*="composer" i]',
        '[aria-label*="message" i]',
        '[class*="inputarea" i]',
        '[class*="input-area" i]',
        '[class*="composer" i]',
        '[class*="messageinput" i]',
        '[class*="message-input" i]',
        '[class*="chatinput" i]',
        '[class*="chat-input" i]',
        '[class*="promptinput" i]',
        '[class*="prompt-input" i]',
    ];
    try {
        return Array.from(document.querySelectorAll(selectors.join(',')))
            .filter((el) => el instanceof HTMLElement)
            .filter(isVisibleElement)
            .filter((el) => {
            const rect = el.getBoundingClientRect();
            return (rect.width >= viewportWidth() * 0.42 &&
                rect.height >= 32 &&
                rect.height <= Math.min(340, viewportHeight() * 0.44) &&
                rect.bottom >= viewportHeight() * 0.56);
        })
            .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    }
    catch {
        return [];
    }
}
function findInputAnchor() {
    // Lumi exposes the composer as data-component="InputArea" in current desktop/mobile
    // builds. Prefer the shell when available; mobile sometimes does not expose a normal
    // textarea/input until focus, which made the older builds hide forever.
    const shell = findInputShellCandidates()[0];
    if (shell)
        return shell;
    const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"], input[type="text"], input:not([type]), input[placeholder*="message" i], textarea[placeholder*="message" i]')).filter(isVisibleElement);
    const lowerCandidates = candidates
        .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.bottom > viewportHeight() * 0.50;
    })
        .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    for (const candidate of lowerCandidates) {
        let best = candidate;
        let node = candidate;
        while (node && node !== document.body && node !== document.documentElement) {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            const className = node.className.toString();
            const id = node.id || '';
            const dataComponent = node.getAttribute('data-component') || '';
            const dataPart = node.getAttribute('data-part') || '';
            const aria = node.getAttribute('aria-label') || '';
            const nameHint = `${className} ${id} ${dataComponent} ${dataPart} ${aria}`;
            const isLikelyInputShell = rect.width >= viewportWidth() * 0.42 &&
                rect.height >= 32 &&
                rect.height <= Math.min(340, viewportHeight() * 0.44) &&
                rect.bottom >= viewportHeight() * 0.56 &&
                (style.position === 'fixed' ||
                    style.position === 'absolute' ||
                    style.position === 'sticky' ||
                    /input|composer|message|textarea|prompt|bar|bottom|container/i.test(nameHint));
            if (isLikelyInputShell)
                best = node;
            node = node.parentElement;
        }
        if (best)
            return best;
    }
    return null;
}
function computeBottomAnchor(anchor = findInputAnchor()) {
    if (!anchor)
        return DEFAULT_BOTTOM_ANCHOR;
    const rect = anchor.getBoundingClientRect();
    const bottom = viewportHeight() - rect.top + INPUT_GAP;
    return Number.isFinite(bottom) ? Math.max(0, bottom) : DEFAULT_BOTTOM_ANCHOR;
}
function getClientY(event) {
    if ('touches' in event) {
        const touch = event.touches[0] || event.changedTouches[0];
        return touch ? touch.clientY : null;
    }
    return event.clientY;
}
function rectsOverlap(a, b, padding = 0) {
    return !(a.right < b.left - padding ||
        a.left > b.right + padding ||
        a.bottom < b.top - padding ||
        a.top > b.bottom + padding);
}
function safeNameHint(el) {
    return [
        el.id,
        el.className?.toString?.() || '',
        el.getAttribute('data-component') || '',
        el.getAttribute('data-part') || '',
        el.getAttribute('data-testid') || '',
        el.getAttribute('aria-label') || '',
    ]
        .join(' ')
        .toLowerCase();
}
function hasOpenPopover(el) {
    if (!el.hasAttribute('popover'))
        return false;
    try {
        if (el.matches(':popover-open'))
            return true;
    }
    catch {
        // Some WebViews do not support :popover-open yet.
    }
    return isVisibleElement(el);
}
function isPotentialBlockingUi(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const role = (el.getAttribute('role') || '').toLowerCase();
    const nameHint = safeNameHint(el);
    const position = style.position;
    const zIndex = Number.parseInt(style.zIndex, 10);
    const floating = position === 'fixed' || position === 'absolute' || position === 'sticky';
    const hasUsefulZIndex = Number.isFinite(zIndex) && zIndex >= zIndexThreshold();
    const hasOverlayName = /modal|dialog|drawer|sheet|sidebar|side-bar|popover|popper|dropdown|menu|select|portal|floating|tooltip|overlay|command|cmdk|palette|toast/i.test(nameHint);
    const hasOverlayRole = /dialog|menu|listbox|tooltip|tree|grid/.test(role);
    const isLargePanel = rect.width > viewportWidth() * 0.45 && rect.height > viewportHeight() * 0.28;
    const isBottomUi = rect.bottom > viewportHeight() * 0.55 && rect.width > viewportWidth() * 0.35 && rect.height > 44;
    return (el.getAttribute('aria-modal') === 'true' ||
        hasOpenPopover(el) ||
        (hasOverlayName && (floating || hasUsefulZIndex || isLargePanel || isBottomUi)) ||
        (hasOverlayRole && (floating || hasUsefulZIndex || isBottomUi)));
}
function queryPotentialBlockingElements() {
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
    ];
    try {
        return Array.from(document.querySelectorAll(selectors.join(','))).filter((el) => el instanceof HTMLElement);
    }
    catch {
        return [];
    }
}
function isProbablyEdgePanel(el, side, ruler, inputAnchor) {
    if (el === ruler || ruler.contains(el))
        return false;
    if (el === inputAnchor || inputAnchor.contains(el) || el.contains(inputAnchor))
        return false;
    if (el === document.body || el === document.documentElement)
        return false;
    if (!isVisibleElement(el))
        return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const nameHint = safeNameHint(el);
    const role = (el.getAttribute('role') || '').toLowerCase();
    const position = style.position;
    const zIndex = Number.parseInt(style.zIndex, 10);
    const vw = viewportWidth();
    const vh = viewportHeight();
    const touchesEdge = side === 'right' ? rect.right >= vw - 4 : rect.left <= 4;
    const substantialWidth = rect.width >= 42;
    const substantialHeight = rect.height >= Math.min(160, vh * 0.22);
    const floating = position === 'fixed' || position === 'absolute' || position === 'sticky';
    const highZ = Number.isFinite(zIndex) && zIndex >= zIndexThreshold();
    const namedLikePanel = /sidebar|side-bar|dock|drawer|sheet|panel|rail|nav|navigation|settings|extension|profile|loom|weaver|connect|browser|chars|character|persona|lore|memory|data/i.test(nameHint);
    const roleLikePanel = /dialog|navigation|complementary/.test(role);
    const fullHeightRail = rect.height > vh * 0.64;
    const nearOwnSide = side === 'right' ? rect.left >= vw * 0.38 : rect.right <= vw * 0.62;
    const nearlyFullscreen = rect.left <= 4 && rect.right >= vw - 4;
    const tooWideForPanel = rect.width > Math.min(maxEdgePanelWidth(ruler), vw * 0.52);
    const narrowRail = rect.width <= 124 && fullHeightRail;
    const mediumPanel = rect.width > 124 && (floating || highZ || namedLikePanel || roleLikePanel);
    // Important: many Lumiverse app-shell/main-content wrappers touch the left edge and are
    // full-height. Treating those as side panels squishes the ruler into the actual sidebar.
    // Edge avoidance is only for narrow rails and plausible dock/drawer panels.
    if (nearlyFullscreen || tooWideForPanel || !nearOwnSide)
        return false;
    return touchesEdge && substantialWidth && substantialHeight && (narrowRail || mediumPanel);
}
function edgePanelInsets(ruler, inputAnchor, bottomAnchor) {
    if (isMobileViewport(ruler))
        return { left: 0, right: 0 };
    const height = Number.parseFloat(ruler.style.height) ||
        ruler.getBoundingClientRect().height ||
        readSavedHeight() ||
        DEFAULT_HEIGHT;
    const top = Math.max(0, viewportHeight() - bottomAnchor - height);
    const bottom = Math.min(viewportHeight(), viewportHeight() - bottomAnchor);
    const samples = [
        top + 18,
        top + Math.max(26, (bottom - top) * 0.42),
        Math.max(top + 18, bottom - 18),
        viewportHeight() * 0.5,
    ]
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.max(1, Math.min(viewportHeight() - 1, value)));
    const gap = sidePanelGap(ruler);
    let left = 0;
    let right = 0;
    for (const y of samples) {
        for (const side of ['left', 'right']) {
            const x = side === 'right' ? viewportWidth() - 2 : 2;
            const elements = document.elementsFromPoint(x, y);
            for (const element of elements) {
                if (!(element instanceof HTMLElement))
                    continue;
                if (!isProbablyEdgePanel(element, side, ruler, inputAnchor))
                    continue;
                const rect = element.getBoundingClientRect();
                if (side === 'right') {
                    right = Math.max(right, viewportWidth() - rect.left + gap);
                }
                else {
                    left = Math.max(left, rect.right + gap);
                }
            }
        }
    }
    return { left, right };
}
function horizontalInsets(ruler, inputAnchor, bottomAnchor) {
    const rect = inputAnchor.getBoundingClientRect();
    const baseInset = sideInset(ruler);
    let left = baseInset;
    let right = baseInset;
    if (rect.width >= viewportWidth() * 0.38 && rect.height >= 28) {
        left = Math.max(left, Math.floor(rect.left));
        right = Math.max(right, Math.floor(viewportWidth() - rect.right));
    }
    const edgeInsets = edgePanelInsets(ruler, inputAnchor, bottomAnchor);
    const maxPanelInset = maxEdgePanelWidth(ruler) + sidePanelGap(ruler);
    left = Math.max(left, Math.min(edgeInsets.left, maxPanelInset));
    right = Math.max(right, Math.min(edgeInsets.right, maxPanelInset));
    const maxTotalInset = Math.max(0, viewportWidth() - minRulerWidth(ruler));
    if (left + right > maxTotalInset) {
        const overflow = left + right - maxTotalInset;
        if (left > right)
            left = Math.max(baseInset, left - overflow);
        else
            right = Math.max(baseInset, right - overflow);
    }
    return { left: Math.round(left), right: Math.round(right) };
}
function shouldYieldToAppUi(ruler, inputAnchor) {
    ruler.dataset.blocker = '';
    // Mobile Lumi/WebView chrome can expose ordinary app wrappers as "open"
    // dialogs, portals, menus, or data-state panels. Earlier builds obeyed those
    // too politely and hid forever with data-reason="blocked-ui". Default mobile
    // behavior is now: show in chat. People who prefer the old experimental mobile
    // yielding can opt back in with --lrr-mobile-yield-ui: 1.
    if (isMobileViewport(ruler) && !mobileYieldUi(ruler))
        return false;
    const rulerRect = ruler.getBoundingClientRect();
    const handleRect = ruler.querySelector('.reading-ruler-handle')?.getBoundingClientRect() || rulerRect;
    const mobile = isMobileViewport(ruler);
    for (const el of queryPotentialBlockingElements()) {
        if (el === ruler || ruler.contains(el))
            continue;
        if (inputAnchor && (el === inputAnchor || el.contains(inputAnchor) || inputAnchor.contains(el)))
            continue;
        if (!isVisibleElement(el))
            continue;
        if (!isPotentialBlockingUi(el))
            continue;
        const rect = el.getBoundingClientRect();
        const role = (el.getAttribute('role') || '').toLowerCase();
        const nameHint = safeNameHint(el);
        const intersectsRuler = rectsOverlap(rect, rulerRect, 10) || rectsOverlap(rect, handleRect, 16);
        const bottomPopover = rect.bottom > viewportHeight() * 0.52 && rect.width > viewportWidth() * 0.35 && rect.height > 48;
        if (mobile) {
            // On mobile, the app shell/input chrome often looks like a full-screen overlay in
            // computed CSS. Be conservative: only yield to obvious modals/sheets/popovers/menus.
            const hardModal = el.getAttribute('aria-modal') === 'true' ||
                role === 'dialog' ||
                /modal|dialog|drawer|sheet/i.test(nameHint);
            const popup = hasOpenPopover(el) ||
                /menu|listbox|tooltip/.test(role) ||
                /popover|popper|dropdown|menu|select|tooltip|floating|portal/i.test(nameHint);
            if (hardModal && (intersectsRuler || rect.width > viewportWidth() * 0.62 || rect.height > viewportHeight() * 0.36)) {
                ruler.dataset.blocker = nameHint || role || el.tagName.toLowerCase();
                return true;
            }
            if (popup && (intersectsRuler || bottomPopover)) {
                ruler.dataset.blocker = nameHint || role || el.tagName.toLowerCase();
                return true;
            }
            continue;
        }
        const hugeOverlay = rect.width > viewportWidth() * 0.72 && rect.height > viewportHeight() * 0.45;
        if (hugeOverlay || intersectsRuler || bottomPopover) {
            ruler.dataset.blocker = nameHint || role || el.tagName.toLowerCase();
            return true;
        }
    }
    return false;
}
export function setup(ctx) {
    const win = window;
    win[GLOBAL_CLEANUP_KEY]?.();
    const initialAnchor = findInputAnchor();
    const initialBottom = computeBottomAnchor(initialAnchor);
    const initialHeight = clampHeight(readSavedHeight() ?? readCssNumber('--lrr-default-height', DEFAULT_HEIGHT), initialBottom);
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

    #${TOGGLE_ID} {
      position: fixed;
      right: var(--lrr-mobile-toggle-right, 14px);
      bottom: var(--lrr-runtime-toggle-bottom, calc(var(--lrr-mobile-toggle-bottom, 98px) + env(safe-area-inset-bottom, 0px)));
      z-index: var(--lrr-toggle-z-index, 30);
      display: none;
      align-items: center;
      justify-content: center;
      min-width: var(--lrr-toggle-min-width, 56px);
      height: var(--lrr-toggle-height, 34px);
      padding: var(--lrr-toggle-padding, 0 11px);
      border-radius: var(--lrr-toggle-radius, 999px);
      border: var(--lrr-toggle-border, 1px solid rgba(245, 239, 255, 0.24));
      background: var(--lrr-toggle-background, rgba(31, 29, 40, 0.76));
      color: var(--lrr-toggle-color, rgba(248, 245, 255, 0.92));
      box-shadow: var(--lrr-toggle-shadow, 0 8px 22px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.10));
      backdrop-filter: blur(var(--lrr-toggle-blur, 12px)) saturate(var(--lrr-toggle-saturate, 118%));
      -webkit-backdrop-filter: blur(var(--lrr-toggle-blur, 12px)) saturate(var(--lrr-toggle-saturate, 118%));
      font: var(--lrr-toggle-font, 600 11px/1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      letter-spacing: var(--lrr-toggle-letter-spacing, 0.04em);
      text-transform: var(--lrr-toggle-text-transform, uppercase);
      pointer-events: auto;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      opacity: var(--lrr-toggle-opacity, 0.92);
      transform: translateY(6px) scale(0.98);
      transition:
        opacity 140ms ease,
        transform 140ms ease,
        background-color 140ms ease;
    }

    #${TOGGLE_ID}[data-visible="true"] {
      display: flex;
      transform: translateY(0) scale(1);
    }

    #${TOGGLE_ID}[data-enabled="false"] {
      opacity: var(--lrr-toggle-off-opacity, 0.66);
      background: var(--lrr-toggle-off-background, rgba(18, 17, 24, 0.74));
      color: var(--lrr-toggle-off-color, rgba(248, 245, 255, 0.68));
    }

    #${TOGGLE_ID} .reading-ruler-toggle-label::before {
      content: var(--lrr-toggle-label-on, 'Ruler');
    }

    #${TOGGLE_ID}[data-enabled="false"] .reading-ruler-toggle-label::before {
      content: var(--lrr-toggle-label-off, 'Ruler');
    }

  `);
    const wrapper = ctx.dom.inject('body', `<div id="${ROOT_ID}" aria-label="Expandable reading ruler"><button class="reading-ruler-handle" type="button" aria-label="Drag to resize reading ruler"></button></div>`, 'beforeend');
    const toggleWrapper = ctx.dom.inject('body', `<button id="${TOGGLE_ID}" type="button" aria-label="Toggle reading ruler" aria-pressed="true"><span class="reading-ruler-toggle-label" aria-hidden="true"></span></button>`, 'beforeend');
    const ruler = document.getElementById(ROOT_ID);
    const handle = ruler?.querySelector('.reading-ruler-handle');
    const toggle = document.getElementById(TOGGLE_ID);
    if (!ruler || !handle || !toggle) {
        removeStyle();
        ctx.dom.uninject(wrapper);
        ctx.dom.uninject(toggleWrapper);
        return () => undefined;
    }
    let dragging = false;
    let activePointerId = null;
    let startY = 0;
    let startHeight = 0;
    let lastBottomAnchor = initialBottom;
    let syncFrame = 0;
    let mobileEnabled = readMobileEnabled();
    const applyToggleState = (visible) => {
        toggle.dataset.visible = visible ? 'true' : 'false';
        toggle.dataset.enabled = mobileEnabled ? 'true' : 'false';
        toggle.setAttribute('aria-pressed', mobileEnabled ? 'true' : 'false');
        toggle.setAttribute('aria-label', mobileEnabled ? 'Hide reading ruler' : 'Show reading ruler');
    };
    const applyTogglePosition = (inputAnchor) => {
        const anchorBottom = inputAnchor ? computeBottomAnchor(inputAnchor) : lastBottomAnchor;
        const bottom = Math.max(72, anchorBottom + readCssNumber('--lrr-mobile-toggle-gap', 10, ruler));
        toggle.style.setProperty('--lrr-runtime-toggle-bottom', `${Math.round(bottom)}px`);
    };
    const setMobileEnabled = (next, persist = true) => {
        mobileEnabled = next;
        if (persist)
            saveMobileEnabled(next);
        applyToggleState(isMobileViewport(ruler) && mobileToggleAllowed(ruler));
        scheduleSync();
    };
    const applyHeight = (nextHeight, persist = true) => {
        const clamped = clampHeight(nextHeight, lastBottomAnchor, ruler);
        ruler.style.height = `${clamped}px`;
        if (persist)
            saveHeight(clamped);
    };
    const applyHorizontalInsets = (inputAnchor) => {
        const insets = horizontalInsets(ruler, inputAnchor, lastBottomAnchor);
        ruler.style.setProperty('--lrr-runtime-left', `${insets.left}px`);
        ruler.style.setProperty('--lrr-runtime-right', `${insets.right}px`);
    };
    const applyBottomAnchor = (nextBottom, inputAnchor) => {
        lastBottomAnchor = nextBottom;
        ruler.style.bottom = `${nextBottom}px`;
        if (inputAnchor)
            applyHorizontalInsets(inputAnchor);
        const currentHeight = Number.parseFloat(window.getComputedStyle(ruler).height);
        applyHeight(Number.isFinite(currentHeight) ? currentHeight : initialHeight, false);
    };
    const syncVisibility = () => {
        const inputAnchor = findInputAnchor();
        const mobile = isMobileViewport(ruler);
        const activeChat = isChatRoute() || inputAnchor !== null || looksLikeMobileChatScreen();
        const showMobileToggle = mobile && activeChat && mobileToggleAllowed(ruler);
        applyTogglePosition(inputAnchor);
        applyToggleState(showMobileToggle);
        if (!activeChat) {
            ruler.dataset.active = 'false';
            ruler.dataset.reason = 'no-chat';
            return;
        }
        if (mobile && mobileToggleAllowed(ruler) && !mobileEnabled) {
            ruler.dataset.active = 'false';
            ruler.dataset.reason = 'mobile-disabled';
            return;
        }
        if (!dragging) {
            applyBottomAnchor(computeBottomAnchor(inputAnchor), inputAnchor);
            const saved = readSavedHeight();
            if (saved !== null)
                applyHeight(saved, false);
        }
        if (inputAnchor) {
            applyHorizontalInsets(inputAnchor);
        }
        else if (mobile) {
            ruler.style.setProperty('--lrr-runtime-left', 'var(--lrr-side-inset, 10px)');
            ruler.style.setProperty('--lrr-runtime-right', 'var(--lrr-side-inset, 10px)');
        }
        const blockedByUi = !dragging && shouldYieldToAppUi(ruler, inputAnchor);
        ruler.dataset.reason = blockedByUi ? 'blocked-ui' : 'active';
        ruler.dataset.active = blockedByUi ? 'false' : 'true';
    };
    const scheduleSync = () => {
        cancelAnimationFrame(syncFrame);
        syncFrame = requestAnimationFrame(syncVisibility);
    };
    const beginDrag = (event) => {
        const clientY = getClientY(event);
        if (clientY === null)
            return;
        dragging = true;
        ruler.dataset.dragging = 'true';
        startY = clientY;
        startHeight = ruler.getBoundingClientRect().height || initialHeight;
        if ('pointerId' in event) {
            activePointerId = event.pointerId;
            try {
                handle.setPointerCapture(event.pointerId);
            }
            catch {
                // Window listeners below still handle drag in cranky mobile webviews.
            }
        }
        event.preventDefault();
    };
    const continueDrag = (event) => {
        if (!dragging)
            return;
        if ('pointerId' in event && activePointerId !== null && event.pointerId !== activePointerId)
            return;
        const clientY = getClientY(event);
        if (clientY === null)
            return;
        const delta = startY - clientY;
        applyHeight(startHeight + delta);
        event.preventDefault();
    };
    const endDrag = (event) => {
        if ('pointerId' in (event || {}) && activePointerId !== null && event.pointerId !== activePointerId)
            return;
        if (event && 'pointerId' in event) {
            try {
                if (handle.hasPointerCapture(event.pointerId))
                    handle.releasePointerCapture(event.pointerId);
            }
            catch {
                // Ignore pointer-capture cleanup failures.
            }
        }
        dragging = false;
        activePointerId = null;
        ruler.dataset.dragging = 'false';
        scheduleSync();
    };
    const onResize = () => {
        const inputAnchor = findInputAnchor();
        applyBottomAnchor(computeBottomAnchor(inputAnchor), inputAnchor);
        const saved = readSavedHeight();
        applyHeight(saved ?? readCssNumber('--lrr-default-height', DEFAULT_HEIGHT, ruler), false);
        scheduleSync();
    };
    const toggleMobile = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMobileEnabled(!mobileEnabled);
    };
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-state', 'aria-hidden', 'aria-modal', 'popover'],
    });
    const supportsPointer = 'PointerEvent' in window;
    if (supportsPointer) {
        handle.addEventListener('pointerdown', beginDrag, { passive: false });
        window.addEventListener('pointermove', continueDrag, { passive: false });
        window.addEventListener('pointerup', endDrag, { passive: false });
        window.addEventListener('pointercancel', endDrag, { passive: false });
    }
    else {
        handle.addEventListener('mousedown', beginDrag, { passive: false });
        window.addEventListener('mousemove', continueDrag, { passive: false });
        window.addEventListener('mouseup', endDrag, { passive: false });
        handle.addEventListener('touchstart', beginDrag, { passive: false });
        window.addEventListener('touchmove', continueDrag, { passive: false });
        window.addEventListener('touchend', endDrag, { passive: false });
        window.addEventListener('touchcancel', endDrag, { passive: false });
    }
    toggle.addEventListener('click', toggleMobile);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('popstate', scheduleSync);
    window.addEventListener('hashchange', scheduleSync);
    const interval = window.setInterval(syncVisibility, 500);
    syncVisibility();
    const cleanup = () => {
        cancelAnimationFrame(syncFrame);
        window.clearInterval(interval);
        observer.disconnect();
        if (supportsPointer) {
            handle.removeEventListener('pointerdown', beginDrag);
            window.removeEventListener('pointermove', continueDrag);
            window.removeEventListener('pointerup', endDrag);
            window.removeEventListener('pointercancel', endDrag);
        }
        else {
            handle.removeEventListener('mousedown', beginDrag);
            window.removeEventListener('mousemove', continueDrag);
            window.removeEventListener('mouseup', endDrag);
            handle.removeEventListener('touchstart', beginDrag);
            window.removeEventListener('touchmove', continueDrag);
            window.removeEventListener('touchend', endDrag);
            window.removeEventListener('touchcancel', endDrag);
        }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        window.removeEventListener('popstate', scheduleSync);
        window.removeEventListener('hashchange', scheduleSync);
        toggle.removeEventListener('click', toggleMobile);
        removeStyle();
        ctx.dom.uninject(wrapper);
        ctx.dom.uninject(toggleWrapper);
        ctx.dom.cleanup();
        if (win[GLOBAL_CLEANUP_KEY] === cleanup)
            delete win[GLOBAL_CLEANUP_KEY];
    };
    win[GLOBAL_CLEANUP_KEY] = cleanup;
    return cleanup;
}
