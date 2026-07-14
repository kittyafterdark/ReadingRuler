# Lumiverse Reading Ruler

Tiny frontend-only Lumiverse / Spindle extension that adds a draggable frosted-glass reading ruler over chat pages.

## What it does

- Shows only on `/chat/:chatId` routes.
- Adds one thin fixed frosted strip above the input area.
- Lets you drag the larger center pill handle up and down.
- Saves the strip position in `localStorage` using the v2 key `lumi-reading-ruler-v2-bottom`.
- Uses no backend and asks for no permissions.
- Lets scrolling and tapping pass through the glass body; only the handle captures touch/click drag.

## Changes in 1.0.1

- Fixed the ruler showing on the Lumiverse landing / character grid.
- Reduced the strip height from 92px to 46px.
- Made the drag handle much easier to grab on mobile.
- Added mouse, touch, and pointer-event drag handling.
- Added a cleanup guard so hot reloads / reinstall tests do not leave old listeners around.

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

## Troubleshooting

If an older test build left the ruler in a weird position, clear this key in DevTools/localStorage:

```text
lumi-reading-ruler-v2-bottom
```

The older prototype used `lumi-reading-ruler-bottom`; this build does not read that key.
