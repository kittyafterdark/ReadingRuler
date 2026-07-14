# Lumiverse Reading Ruler

Tiny frontend-only Lumiverse / Spindle extension that adds a draggable frosted-glass reading ruler over the chat.

## What it does

- Adds one fixed frosted strip above the input area.
- Lets you drag the small pill handle up and down.
- Saves the strip position in `localStorage`.
- Uses no backend and asks for no permissions.
- Lets scrolling and tapping pass through the glass body; only the handle captures touch/click drag.

## Test install

The ZIP already includes `dist/frontend.js`, so it should be usable without building.

If you edit `src/frontend.ts`, rebuild with:

```bash
bun install
bun run build
```

## Files

```text
spindle.json
src/frontend.ts
dist/frontend.js
package.json
tsconfig.json
```

## Notes

The `github` and `homepage` fields in `spindle.json` are placeholders for testing. Swap them before publishing.
