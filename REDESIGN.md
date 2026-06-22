# Forge Master — Reforged 🔨

A ground-up gameplay & UI rebuild. The old project had a solid forge→equip→fight
core buried under **five parallel progression systems** (forge levels, player XP,
tech tree, skills, milestones) and **three currencies** (gold, diamonds, essence),
plus dead "Coming soon" tabs and multi-day real-time timers. New players couldn't
tell what mattered.

**Reforged keeps the working backend** (auth, JWT, sockets, save system, PvP engine,
stat math, database) and **rebuilds the game on top of it** around one tight loop.

## The loop

```
   ┌─────────────────────────────────────────────┐
   │  FORGE gear ─► EQUIP the best ─► POWER ↑      │
   │      ▲                              │         │
   │      │   gold                       ▼         │
   │   ARENA (PvE ladder)  ◄──►  PvP (live ladder) │
   │      └──────────► CLAN (shared progress) ◄────┘
   └─────────────────────────────────────────────┘
```

1. **Forge** — Tap the anvil for a random item with a punchy rarity reveal.
   Upgrade the forge with gold (instant — **no timers**) to improve rarity odds.
2. **Equip** — Every drop shows a side-by-side comparison with a single, honest
   **Power** delta. Equip it or sell it for gold.
3. **Arena** — A PvE ladder. Auto-resolved duels against scaling opponents.
   Win → gold + climb a rank. Your gear is the only thing that gets you deeper.
4. **PvP** — Live duels against real players over the existing Socket.io engine.
   Elo ladder + leaderboard.
5. **Clan** — Create or join a clan. Contribute gold to the clan treasury to raise
   the **clan level**, which grants passive perks (**+gold**, **+forge luck**) to
   *every* member. Clans rank on a global leaderboard by total member power.

## One currency

**Gold** does everything: forge upgrades, clan contributions, and it's what you earn
from arena wins and selling gear. Diamonds, essence, shards, and the IAP shop are gone.

## What was kept (infra)

- `server/` — Express + Prisma + Socket.io, auth (guest/OAuth/password), JWT refresh
  rotation, game-state save/load, the live PvP match engine, chat, admin/moderation.
- `shared/stats.js` — item stat & power-score math (single source of truth, also used
  by the server for matchmaking & PvP). Item shape is **unchanged**, so existing saves
  and the PvP engine keep working.
- `src/api.js`, `src/auth.js`, `src/socket-client.js`, `src/events.js` — client plumbing.

## What's new

- `server/routes/clans.js` + `Clan` / `ClanMember` Prisma models — the collaborative layer.
- A clean client under `src/game/` (model) and `src/screens/` (views) with a single
  cohesive stylesheet `css/reforged.css`.

## Architecture

```
src/
  main.js              entry: wires events → screens, boots the app
  api.js auth.js        ─┐
  socket-client.js       ├─ kept infra (JWT, sockets, event bus)
  events.js  i18n/      ─┘
  game/                  model layer (no DOM)
    config.js            constants: forge odds, arena & clan scaling
    items.js             item naming, icons, rarity helpers
    forge.js             roll an item (reuses shared stat math)
    state.js             game state + debounced save/load via /api/game/state
    arena.js             PvE duel simulation
    clan.js              clan REST client
    pvp.js               live PvP socket client
  screens/               view layer (DOM)
    app.js               shell: header, bottom-nav, routing, toasts/modals
    forge.js arena.js pvp.js clan.js profile.js
    components.js         shared renderers (item card, power delta, modal)
css/
  reforged.css           one stylesheet, dark-fantasy theme
```

## Deferred (noted, not built this pass)

- Real-time **clan chat** (the chat socket already supports channels — easy follow-up).
- Re-wiring **i18n** across the new screens (kept for the auth screen; new UI is
  English-first with strings centralized for later extraction).
- Seasonal PvP resets, achievements, item enchanting.
</content>
</invoke>
