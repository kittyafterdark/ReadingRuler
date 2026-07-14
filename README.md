# Lumi Reading Ruler

Tiny frontend-only Lumiverse extension that adds a frosted glass reading/censor ruler on chat pages.

## Behavior

- Shows on chat routes when the chat input is visible. Mobile also checks for Lumi's `data-component="InputArea"`, message placeholders, and chat-screen text so it does not vanish when the WebView hides the real textbox until focus.
- Anchors near the input/composer area.
- Drag the pill handle upward to expand the frosted glass curtain.
- Drag the pill handle downward to collapse it.
- The body ignores pointer events so normal scrolling/tapping is not blocked.
- The ruler yields to app UI: modals, dropdowns, and input popovers should appear above it or temporarily hide it.
- On desktop, the ruler avoids edge-mounted side panels/dock panels by shrinking away from the left/right edge when one is visible. On mobile, side-panel avoidance is disabled and overlay hiding is conservative, so app chrome should not suppress the ruler forever.
- The saved height persists in `localStorage` under `lumi-reading-ruler-v3-height`.

## CSS variables

Override these from user CSS/theme CSS. Root-level variables are supported, so this is fine:

```css
:root {
  --lrr-blur: 16px;
  --lrr-opacity: 0.82;
  --lrr-side-inset: 14px;
  --lrr-side-panel-gap: 10px;
  --lrr-radius: 10px 10px 0 0;
  --lrr-handle-width: 150px;
}
```

Main layout / behavior variables:

```css
:root {
  --lrr-z-index: 24;
  --lrr-default-height: 84px;
  --lrr-min-height: 38px;
  --lrr-top-margin: 34px;
  --lrr-side-inset: 10px;
  --lrr-side-panel-gap: 8px;
  --lrr-min-width: 180px;
  --lrr-max-edge-panel-width: 680px;
  --lrr-mobile-breakpoint: 760px;
  --lrr-mobile-yield-ui: 0;
}
```

Visual variables:

```css
:root {
  --lrr-opacity: 0.90;
  --lrr-drag-opacity: 0.98;
  --lrr-blur: 12px;
  --lrr-saturate: 118%;
  --lrr-background:
    linear-gradient(180deg, rgba(255,255,255,.11), rgba(255,255,255,.035)),
    linear-gradient(180deg, rgba(40,38,52,.58), rgba(8,8,12,.64));
  --lrr-border-top: 1px solid rgba(245,239,255,.22);
  --lrr-border-inline: 1px solid rgba(235,226,255,.10);
  --lrr-border-bottom: 1px solid rgba(0,0,0,.20);
  --lrr-radius: 12px 12px 0 0;
  --lrr-shadow:
    0 -10px 28px rgba(0,0,0,.30),
    inset 0 1px 0 rgba(255,255,255,.09),
    inset 0 -1px 0 rgba(0,0,0,.30);
  --lrr-line-gap: 12px;
  --lrr-texture-opacity: 0.62;
}
```

Handle variables:

```css
:root {
  --lrr-handle-hit-top: -32px;
  --lrr-handle-hit-height: 58px;
  --lrr-handle-top: 17px;
  --lrr-handle-width: 172px;
  --lrr-handle-height: 8px;
  --lrr-handle-radius: 999px;
  --lrr-handle-drag-filter: brightness(1.14);
}
```

## Files

```text
lumi-reading-ruler/
├── spindle.json
├── package.json
├── tsconfig.json
├── README.md
├── src/frontend.ts
└── dist/frontend.js
```

`dist/frontend.js` is already included for quick testing.

## Dev

```bash
bun install
bun run build
```

## Notes

This is intentionally simple: no backend, no permissions, no settings panel. It injects one DOM node and one stylesheet, then cleans both up when the extension unloads.


## Mobile fallback notes

Version 1.0.7 added a direct `data-component="InputArea"` composer fallback and a mobile chat-screen fallback. This is for mobile WebViews/PWAs where the visible composer may not expose a normal `textarea`/`input` until the user focuses it.

For debugging, inspect the injected node in DevTools: `#lumi-reading-ruler` has `data-reason="active"`, `data-reason="no-chat"`, or `data-reason="blocked-ui"`.


## 1.0.9 mobile note

Mobile overlay yielding is now opt-in. Some Android/WebView builds report normal Lumi chrome as open dialogs/portals, which made the ruler hide forever with `data-reason="blocked-ui"`. By default, mobile now prioritizes showing the ruler in chat. To re-enable experimental mobile UI yielding, add:

```css
:root {
  --lrr-mobile-yield-ui: 1;
}
```

For debugging, `#lumi-reading-ruler` also exposes `data-blocker` when an element triggers UI yielding.

## 1.0.9 mobile toggle note

Mobile now gets a small floating toggle button. It appears on mobile chat screens and lets you hide/show the ruler without disabling the extension. This is useful when a sidebar, drawer, or settings panel opens over the chat and the frosted strip would otherwise cover too much of it.

The toggle state persists in `localStorage` under:

```text
lumi-reading-ruler-mobile-enabled
```

Mobile toggle CSS variables:

```css
:root {
  --lrr-mobile-toggle-enabled: 1;
  --lrr-mobile-toggle-gap: 10px;
  --lrr-mobile-toggle-right: 14px;
  --lrr-toggle-z-index: 30;
  --lrr-toggle-min-width: 56px;
  --lrr-toggle-height: 34px;
  --lrr-toggle-padding: 0 11px;
  --lrr-toggle-radius: 999px;
  --lrr-toggle-background: rgba(31, 29, 40, 0.76);
  --lrr-toggle-off-background: rgba(18, 17, 24, 0.74);
  --lrr-toggle-color: rgba(248, 245, 255, 0.92);
  --lrr-toggle-off-color: rgba(248, 245, 255, 0.68);
  --lrr-toggle-label-on: 'Ruler';
  --lrr-toggle-label-off: 'Ruler';
}
```

Set `--lrr-mobile-toggle-enabled: 0;` to remove the mobile toggle entirely.
