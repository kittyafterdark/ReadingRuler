# Lumi Reading Ruler

Tiny frontend-only Lumiverse extension that adds a frosted glass reading/censor ruler on chat pages.

## Behavior

- Shows only on `/chat/:chatId` routes.
- Anchors near the input/composer area.
- Drag the pill handle upward to expand the frosted glass curtain.
- Drag the pill handle downward to collapse it.
- The body ignores pointer events so normal scrolling/tapping is not blocked.
- The saved height persists in `localStorage` under `lumi-reading-ruler-v3-height`.

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
