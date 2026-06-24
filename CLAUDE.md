# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

**Gear Master** is a full-stack web RPG (the "Reforged" rebuild — see `REDESIGN.md`).
A single Node process serves a Vite-built vanilla-JS frontend plus an Express + Socket.io
API backed by Prisma/PostgreSQL.

**Live deployment:** Railway — https://web-production-aeea.up.railway.app/ (built from
`main`). The app is **no longer hosted on GitHub Pages**; it needs the backend, so the
full game only runs as the combined server. `railway.json` + `Procfile` define the
deploy (`prisma generate` + `vite build`, then `node server/index.js`).

## Core game loop (current behavior)

Forge gear → equip the best (Power delta) → idle-battle the PvE Arena → fight live PvP →
pool gold in a Clan for passive perks. **One currency: Gold.** Diamonds/essence and the
Stripe shop exist in the schema/server but are **dormant** — not part of the live loop.

- **Screens / bottom nav:** `pvp`, `home`, `clan` (Profile is reached via the header
  avatar). The old separate **Forge** and **Arena** tabs are **merged into `home.js`** —
  a unified idle auto-battler with the gear grid and forge below it.
- **Forge:** 8 slots, 7 rarity tiers (Common → Divine), 12 instant gold-gated forge
  levels that shift rarity odds (`FORGE_LEVELS` in `src/game/config.js`). No real-time
  timers. Optional auto-forge.
- **Arena:** auto-resolved duels, endless power scaling (`arenaEnemyPower`/`arenaReward`
  in `config.js`), 2× playback, free cooldown-gated 2×-gold Boost.
- **PvP:** real-time turn-based over Socket.io, power→Elo matchmaking, actions
  attack/defend/special. Stats computed **server-side** (anti-cheat).
- **Clans:** create/join, shared treasury, levels 1–30, perks (+gold, +forge luck, more
  members), global leaderboard by total power. Clan chat is deferred.

## Repository map

```
src/
  main.js                entry — boots auth, loads state, mounts the app
  api.js auth.js socket-client.js events.js   kept infra (JWT, sockets, event bus)
  i18n/                  i18n.js + locales/{en,fr,de,es}.js (en built-in, rest lazy)
  game/                  MODEL layer, no DOM
    config.js            client design knobs (forge odds, arena/clan scaling)
    items.js forge.js    item naming/icons; rolling a fresh item
    state.js             game state + debounced save/load via /api/game/state
    arena.js clan.js pvp.js   PvE sim, clan REST client, live PvP socket client
  screens/               VIEW layer, DOM
    app.js               shell: header, bottom-nav, routing, toasts/modals
    home.js              unified Forge + idle Arena battle screen
    pvp.js clan.js profile.js
    components.js item-view.js   shared renderers (item card, power delta, modals)
  admin-dashboard.js     standalone /admin moderation UI
css/                     reforged.css (game), base.css, admin-dashboard.css
shared/                  SHARED between client AND server — single source of truth
  stats.js               item stat & power math + rarity TIERS
  clan-config.js         clan level/perk/treasury math
  pvp-config.js          PvP matchmaking & combat constants
server/                  Express + Prisma + Socket.io
  index.js config.js
  routes/                auth, game, clans, players, equipment, monsters, sprites,
                         payment, admin
  socket/                index (connection), pvp (live duels), chat
  middleware/auth.js     JWT guard          lib/   prisma client + seed data
prisma/schema.prisma     User, GameState, Clan/ClanMember, ChatMessage, RefreshToken,
                         Ban/Mute/Warning/AuditLog, Purchase, *Template, Sprite(Sheet)
public/                  manifest.json, sw.js (PWA), assets/ (sprite sheets)
admin.html index.html    admin page + game shell entry points
```

## Commands

```bash
npm run dev          # Vite dev server (frontend, hot reload)
npm run dev:server   # Node backend only
npm run build        # production build (Vite → dist/)
npm start            # prisma db push + node server/index.js (prod/Railway)
npm test             # Vitest (run once)
npm run test:watch   # Vitest watch
npm run lint         # ESLint over src/ server/ shared/
npm run format       # Prettier write
npm run db:push      # prisma db push   |  db:generate  |  db:migrate
```

Always run `npm test`, `npm run lint`, and `npm run build` before committing — CI
(`.github/workflows/ci.yml`) runs all three on PRs to `main`.

## Conventions & gotchas

- **Vanilla JS, ES modules, no framework.** DOM is built with the `h()` helper in
  `src/screens/components.js`; communication is via the `gameEvents` bus (`src/events.js`).
- **Keep model and view separate:** logic in `src/game/` (no DOM), rendering in
  `src/screens/`.
- **`shared/` is imported by both client and server** — changing item/power/clan/PvP math
  there affects gameplay AND server-side validation (anti-cheat, matchmaking). Update tests
  in `shared/__tests__/` and `src/game/__tests__/` accordingly.
- **One currency in the live game: Gold.** Don't reintroduce diamonds/essence/IAP into the
  loop — they're intentionally dormant (see `REDESIGN.md`).
- **No real-time timers** in the forge — upgrades are instant and gold-gated by design.
- **Auth:** guest / Discord / Google / username+password, JWT access + rotating refresh.
  Guests fall back to a localStorage save when the backend is unreachable.
- **i18n** is wired through the auth screen; game-screen strings are English-first and
  being migrated — keep new user-facing strings centralized for later extraction.
- **PWA:** `public/sw.js` is network-first for the shell, cache-first for hashed assets;
  bump the cache name (`CACHE`) when changing caching behavior or shipping new icons.
  Icons live in `public/` as SVG (`icon-192`, `icon-512`, `icon-maskable-512`).
- **Tests:** Vitest, colocated in `__tests__/` dirs (forge odds, arena sim, clan math,
  event bus).

## Git workflow

Develop on the designated feature branch; commit with clear messages; push with
`git push -u origin <branch>`. Do **not** open a pull request unless explicitly asked.
</content>
