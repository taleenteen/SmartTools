# SmartTools Vue shell

Bookmark homepage (phase 1). Admin (`/c`) and tools (`/t`) stay as static HTML.

## Stack

Vue 3 · Pinia · Tailwind v4 · shadcn-vue · motion-v · Bun

Read `AGENTS.md` before changing UI.

## Commands

```sh
bun install
bun dev          # http://localhost:5173
bun run check    # types + lint + tests
bun run build
```

From repo root: `bun run dev` · `bun run check` · `bun run pages:build`

## Themes

`notion` (default) · `nebula` · `stripe` · `dark` · `mint`

Switch in the header, or `?theme=stripe`. Palettes live only in `src/assets/styles/themes.css`.
