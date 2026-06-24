# Gear Master 🔨

> A full-stack web RPG about the thrill of the gear chase. **Forge** random equipment,
> **equip** your best, let your hero **idle-battle** the PvE ladder, prove your build in
> live **PvP**, and rise together in a **Clan**.

🎮 **[Play on Railway](https://web-production-aeea.up.railway.app/)**

> ℹ️ This is the **Reforged** rebuild — a ground-up redesign of the gameplay and UI on
> top of the original backend. See [`REDESIGN.md`](./REDESIGN.md) for the why & how.

## The loop

1. **Forge** — Tap the anvil for a random item with a punchy rarity reveal. Every forge
   grants **forge XP** (rarity-weighted — rarer rolls give more) that levels the forge up
   for better odds — or pay gold to upgrade instantly (**no timers**). Auto-forge can keep
   tapping for you.
2. **Equip** — Every drop shows a side-by-side **Power** delta. Equip it or sell it.
3. **Battle (Arena)** — Your hero auto-fights an endless PvE ladder right on the home
   screen. Win for gold and **player XP**; levelling up raises your base HP and base
   attack, and only better gear gets you deeper.
4. **PvP** — Live, turn-based duels against real players over Socket.io. Power/Elo
   matchmaking + leaderboard.
5. **Clan** — Create or join a clan, pool gold into a shared treasury to level it up,
   and grant passive perks (**+gold**, **+forge luck**) to every member.

**One currency — Gold** — powers everything: forge upgrades, clan contributions, and
it's what you earn from arena wins and selling gear.

## Features

- **Forge** — 8 equipment slots, 7 rarity tiers (Common → Divine), random stat & bonus
  rolls (7 bonus types), and 12 forge levels that progressively shift the rarity odds
  toward better gear. Forge levels are earned by forging (forge XP) or bought instantly
  with gold. Optional auto-forge.
- **Battle / Arena** — an idle, auto-resolved PvE ladder merged into the home screen,
  with endless power scaling, cosmetic stage "chapters", and 2× playback. Defeating
  enemies grants player XP; player level raises your base HP and base attack.
- **PvP** — real-time matchmaking (power- then Elo-based), turn-based combat
  (attack / defend / special), power-weighted Elo, top-players leaderboard. Stats are
  computed server-side (anti-cheat).
- **Clans** — create/join, contribute to a treasury, clan levels & perks (+gold,
  +forge luck, larger roster), member roster, global clan leaderboard by total power.
- **Accounts** — guest play, Discord & Google OAuth, username/password, JWT with refresh
  rotation, server-side saves with a localStorage fallback (offline guest mode).
- **Profile** — avatars, power / arena / PvP stats at a glance.
- **i18n** — English, French, German & Spanish (en built-in, others lazy-loaded;
  currently wired through the auth screen, game UI is being migrated).
- **PWA** — installable, offline-capable shell, network-first service worker.
- **Admin/moderation** — separate dashboard at `/admin` (warnings, mutes, bans, kicks,
  message deletion, currency/level grants, role management, broadcasts, audit log).

## Stack

- **Frontend:** Vanilla JS (ES modules), Vite 6, custom EventEmitter, vanilla CSS.
- **Backend:** Node.js + Express 5, Prisma ORM (PostgreSQL), Socket.io, bcrypt, JWT.
- **Payments:** Stripe (checkout + webhooks) — wired but dormant in the current loop.
- **Tests / CI:** Vitest, GitHub Actions (test + build on PR).
- **Hosting:** Railway (Node server + managed PostgreSQL) serves the built frontend and
  the API/sockets from one process.

## Architecture

```
src/
  main.js              entry — boots auth, loads state, mounts the app
  api.js  auth.js       ─┐ kept infra: JWT client, auth flows,
  socket-client.js       ├─ socket connection, event bus, i18n
  events.js  i18n/      ─┘
  game/                  model layer (no DOM)
    config.js items.js forge.js state.js arena.js clan.js pvp.js
  screens/               view layer (DOM)
    app.js               shell: header, bottom-nav, routing, toasts/modals
    home.js              unified Forge + idle Arena battle screen
    pvp.js clan.js profile.js
    components.js item-view.js   shared renderers (item card, power delta, modal)
  admin-dashboard.js     standalone /admin moderation UI
css/
  reforged.css           main game stylesheet (dark-fantasy theme)
  base.css               shared base styles
  admin-dashboard.css    admin panel styles
shared/                  used by client AND server (single source of truth)
  stats.js               item stat & power math, rarity tiers
  clan-config.js         clan level / perk / treasury math
  pvp-config.js          PvP matchmaking & combat constants
server/                  Express + Prisma + Socket.io
  index.js               app entry: serves API + built frontend + sockets
  config.js              server-side config (tokens, packs, OAuth)
  routes/                auth, game, clans, players, equipment, monsters,
                         sprites, payment, admin
  socket/                index (connection), pvp (live duels), chat
  middleware/  lib/      auth guard, prisma client, seed data
prisma/schema.prisma     User, GameState, Clan/ClanMember, ChatMessage,
                         RefreshToken, moderation (Ban/Mute/Warning/AuditLog),
                         Purchase, Item/Monster/Player templates, Sprites
```

## Scripts

```bash
npm run dev          # Vite dev server (frontend)
npm run dev:server   # Node backend
npm run build        # production build
npm start            # prisma db push + start server (used by Railway)
npm test             # Vitest
npm run lint         # ESLint
npm run format       # Prettier
```

## Environment

See `.env.example` — `DATABASE_URL` (Railway PostgreSQL), JWT access/refresh secrets,
Discord & Google OAuth client IDs/secrets (plus `VITE_*` mirrors for the frontend),
Stripe keys, `PORT`, and `CORS_ORIGIN` (defaults to the Railway domain in production).

## Deployment

The app deploys to **Railway** from `main` (see `railway.json` / `Procfile`): the build
runs `prisma generate` + `vite build`, and `node server/index.js` serves both the static
frontend and the API/Socket.io endpoints. Live at
[web-production-aeea.up.railway.app](https://web-production-aeea.up.railway.app/).

## Roadmap

- Real-time clan chat (the chat socket already supports channels).
- Finish wiring i18n across the game screens (auth screen is localized today).
- Seasonal PvP resets, achievements, item enchanting.
</content>
