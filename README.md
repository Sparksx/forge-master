# Forge Master 🔨

> A full-stack web RPG about the thrill of the gear chase. **Forge** random equipment,
> **equip** your best, prove your build in the **Arena** and live **PvP**, and rise
> together in a **Clan**.

🎮 **[Play on GitHub Pages](https://sparksx.github.io/forge-master/)**

> ℹ️ This is the **Reforged** rebuild — a ground-up redesign of the gameplay and UI on
> top of the original backend. See [`REDESIGN.md`](./REDESIGN.md) for the why & how.

## The loop

1. **Forge** — Tap the anvil for a random item with a punchy rarity reveal. Upgrade
   the forge with gold (instant) to improve your odds at rarer gear.
2. **Equip** — Every drop shows a side-by-side **Power** delta. Equip it or sell it.
3. **Arena** — A PvE ladder of auto-resolved duels against scaling opponents. Win for
   gold and climb the ranks; only better gear gets you deeper.
4. **PvP** — Live, turn-based duels against real players over Socket.io. Elo ladder +
   leaderboard.
5. **Clan** — Create or join a clan, pool gold into a shared treasury to level it up,
   and grant passive perks (**+gold**, **+forge luck**) to every member.

**One currency — Gold** — powers everything: forge upgrades, clan contributions, and
it's what you earn from arena wins and selling gear.

## Features

- **Forge** — 8 equipment slots, 7 rarity tiers (Common → Divine), random stat & bonus
  rolls, instant gold-gated forge upgrades that shift the rarity odds.
- **Arena** — animated auto-battler PvE ladder with endless scaling.
- **PvP** — real-time matchmaking, turn-based combat (attack / defend / special),
  power-weighted Elo, top-players leaderboard. Stats are computed server-side (anti-cheat).
- **Clans** — create/join, contribute to a treasury, clan levels & perks, member roster,
  global clan leaderboard by total power.
- **Accounts** — guest play, Discord & Google OAuth, username/password, JWT with refresh
  rotation, server-side saves with a localStorage fallback.
- **Profile** — avatars, power/arena/PvP stats at a glance.
- **PWA** — installable, offline-capable shell, service worker.
- **Admin/moderation** — separate dashboard at `/admin` (bans, mutes, audit log).

## Stack

- **Frontend:** Vanilla JS (ES modules), Vite 6, custom EventEmitter, vanilla CSS.
- **Backend:** Node.js + Express 5, Prisma ORM (PostgreSQL), Socket.io, bcrypt, JWT.
- **Tests / CI:** Vitest, GitHub Actions (test + build on PR), GitHub Pages deploy.

## Architecture

```
src/
  main.js              entry — boots auth, loads state, mounts the app
  api.js auth.js        ─┐ kept infra: JWT client, auth flows,
  socket-client.js       ├─ socket connection, event bus, i18n (auth screen)
  events.js  i18n/      ─┘
  game/                  model layer (no DOM)
    config.js items.js forge.js state.js arena.js clan.js pvp.js
  screens/               view layer (DOM)
    app.js forge.js arena.js pvp.js clan.js profile.js components.js item-view.js
css/
  reforged.css           one cohesive stylesheet
shared/
  stats.js               item stat & power math (used by client AND server)
  clan-config.js         clan level/perk math (shared)
server/
  index.js routes/ socket/ middleware/ lib/   Express + Prisma + Socket.io
  routes/clans.js        clan REST API (new)
prisma/schema.prisma     Clan / ClanMember models added
```

## Scripts

```bash
npm run dev          # Vite dev server (frontend)
npm run dev:server   # Node backend
npm run build        # production build
npm start            # prisma db push + start server
npm test             # Vitest
npm run lint         # ESLint
```

## Environment

See `.env.example` (DATABASE_URL, JWT secrets, OAuth client IDs, port).

## Roadmap

- Real-time clan chat (the chat socket already supports channels).
- Re-wire i18n across the new screens (currently English-first).
- Seasonal PvP resets, achievements, item enchanting.
