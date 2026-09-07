# SmartTools agent and contributor rules

This repo is a Cloudflare Pages bookmark app. A Vue 3 shell lives in `web/` (Bookmarks, Settings, Tools hub). Vanilla `config.html` is rollback only. Individual `tools/*.html` stay static. Do not rewrite `functions/`.

## Stack

- Bun only (`bun.lock`). Do not add `package-lock.json` or `yarn.lock`.
- Vue 3 `<script setup lang="ts">`, Pinia, Vue Router, Tailwind v4, shadcn-vue, motion-v.
- Commands: `bun run --cwd web dev` · `bun run --cwd web check` · `bun run pages:build`

## Non-negotiable

1. **Tokens only.** No raw hex/rgb/oklch in `.vue` files. Colors live in `web/src/assets/styles/themes.css`.
2. **shadcn for primitives.** Button, Dialog, Dropdown, Input, Card, Toast: `bun x shadcn-vue@latest add <name>`. Do not hand-roll replacements.
3. **Do not edit `web/src/components/ui/*` by hand** except to follow a shadcn upgrade. Restyle via tokens.
4. **Share before fork.** Duplicate markup goes to `web/src/components/bookmarks/`. Themes differ by tokens and slots, never by copying a card five times or `if (theme === 'stripe')` trees of markup.
5. **Pinia is for global state only:** `theme`, `bookmarks`, `viewer`, `encrypt`, `ui`, `session`, `editor`, `backups`, `users`, `inbox`, `mode`. Local UI (hover, one dialog) uses `ref`.
6. **Encrypt passwords never go in Pinia persist, localStorage, or logs.** Session-only, in a closure.
7. **Do not invent `data.js` fields** in this phase. Consume the existing schema.
8. **Settings is Vue** (`/settings`, `/c`). Do not add features to `config.html`. Keep that file only as rollback. The Tools hub is Vue (`/t`); do not rewrite individual `tools/*.html` unless the task is a specific tool page.
9. **Motion only on shared components**, with `MotionConfig reduced-motion="user"`.
10. TypeScript: no `any` on domain types. No Options API.
11. **Language.** UI sentences are Thai. Feature names stay English (`Settings`, `Tools`, `Bookmarks`, `Note`, `Unlock`, `Retry`). No new Chinese in `web/src`. Put copy in `web/src/i18n/th.ts`, not inline in components. Do not mass-translate stored `data.js` titles. When a later phase edits `config.html` or `tools/`, apply the same rule on the surfaces you touch.

## Layout

```
web/src/components/ui/          shadcn (CLI-owned)
web/src/components/bookmarks/   shared domain UI
web/src/stores/                 Pinia
web/src/assets/styles/themes.css  the only place for palette hex
functions/                      Cloudflare Pages Functions
```

## Homepage themes

`notion` (default) · `nebula` · `stripe` · `dark` · `mint`

Switch with `html[data-theme]` via `useThemeStore`. Query `?theme=` wins on load. Persist `smarttools-theme` (migrate old `fav_last_style`).
