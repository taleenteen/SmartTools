# Vue app rules (`web/`)

See root `AGENTS.md`. Short version:

- Tokens in `src/assets/styles/themes.css` only.
- shadcn in `src/components/ui` (CLI). Domain components in `src/components/bookmarks`.
- Pinia: `theme` · `bookmarks` · `viewer` · `encrypt` · `ui` · `session` · `editor` · `backups` · `users` · `inbox` · `mode`.
- `bun run check` before considering a slice done (`lint` + `type-check` + unit tests).
- Copy: Thai + English feature names. Source of truth `src/i18n/th.ts`. No Chinese in this app.
