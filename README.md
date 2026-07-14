# Lumi Reading Ruler

Tiny frontend-only Lumiverse extension that adds a frosted glass reading/censor ruler on chat pages.

## Behavior

- Shows only on `/chat/:chatId` routes when the chat input is actually visible.
- Anchors near the input/composer area.
- Drag the pill handle upward to expand the frosted glass curtain.
- Drag the pill handle downward to collapse it.
- The body ignores pointer events so normal scrolling/tapping is not blocked.
- The ruler yields to app UI: modals, dropdowns, and input popovers should appear above it or temporarily hide it.
- The ruler also avoids edge-mounted side panels/dock panels by shrinking away from the left/right edge when one is visible. The edge-panel detector is conservative so it should not mistake the whole app shell for a panel.
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
