# CLAUDE.md - Forge Master

## Project Overview

Forge Master is a browser-based idle/incremental RPG game with real-time PvP combat, equipment forging, tech trees, skill systems, and social features. It uses a vanilla JavaScript frontend (no framework) with a Node.js/Express backend, PostgreSQL database via Prisma ORM, and Socket.io for real-time communication.

**Live deployment:** Frontend on GitHub Pages, backend on Railway.

## Architecture

```
forge-master/
├── server/              # Express + Socket.io backend
│   ├── index.js         # Entry point: Express app, Socket.io, startup tasks
│   ├── config.js        # Environment config (JWT, OAuth, Stripe, diamond packs)
│   ├── lib/             # Prisma client, seed data, migration utilities
│   ├── middleware/       # JWT auth, role-based access, audit logging
│   ├── routes/          # REST API (auth, game, equipment, monsters, players, sprites, payment, admin)
│   └── socket/          # Real-time handlers (chat, PvP matchmaking/combat)
├── src/                 # Vanilla JS frontend (ES6 modules)
│   ├── main.js          # App entry point, CSS imports, initialization
│   ├── state.js         # Centralized game state with getter/setter functions
│   ├── events.js        # Custom EventEmitter for game events
│   ├── api.js           # REST client with JWT auto-refresh
│   ├── auth.js          # Auth flows (OAuth, email/password, guest)
│   ├── socket-client.js # Socket.io client wrapper
│   ├── config.js        # Game balance constants (forge levels, XP, tiers)
│   ├── combat.js        # PvE combat loop and damage calculation
│   ├── forge.js         # Item generation, tier rolling, bonuses
│   ├── pvp.js           # PvP client-side logic
│   ├── skills.js        # Skill effects and cooldowns
│   ├── research.js      # Tech tree progression
│   ├── shop.js          # Shop offers and milestones
│   ├── chat.js          # Chat message handling
│   ├── monsters.js      # Monster template management
│   ├── skill-config.js  # Skill definitions and trees
│   ├── tech-config.js   # Tech definitions and research trees
│   ├── feature-unlock.js # Progressive feature unlock by level
│   ├── ui.js            # UI barrel file (re-exports)
│   ├── ui/              # UI modules (forge-ui, combat-ui, skills-ui, tech-ui, profile-ui, admin-ui, helpers)
│   ├── i18n/            # Internationalization (en, fr, de, es)
│   └── __tests__/       # Vitest unit tests
├── shared/              # Code shared between client and server
│   ├── stats.js         # Stat calculation, equipment types, tier system, power score
│   └── pvp-config.js    # PvP matchmaking constants
├── css/                 # Modular CSS (20 files: base, combat, forge, pvp, skills, etc.)
├── public/              # Static assets (PWA manifest, service worker, sprite sheets)
├── prisma/              # Database schema and seed script
├── scripts/             # Utility scripts (sprite detection, schema diff)
├── docs/                # Stripe setup guide, payment analysis
├── index.html           # Main game HTML
└── admin.html           # Admin dashboard HTML
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES6 modules), modular CSS, Vite |
| Backend | Express.js 5, Socket.io 4 |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (access + refresh tokens), bcrypt, OAuth (Discord, Google) |
| Payments | Stripe |
| Testing | Vitest |
| Linting | ESLint 10 + Prettier |
| Deployment | Railway (backend), GitHub Pages (frontend) |

## Development Commands

```bash
# Frontend dev server (port 5173, proxies /api to :3000)
npm run dev

# Backend dev server (port 3000) - run in separate terminal
npm run dev:server

# Run tests
npm test              # single run
npm run test:watch    # watch mode

# Code quality
npm run lint          # check linting
npm run lint:fix      # auto-fix lint issues
npm run format        # format code with Prettier
npm run format:check  # check formatting

# Database
npm run db:generate   # generate Prisma client
npm run db:migrate    # create and run migration
npm run db:push       # push schema to database

# Production
npm run build         # Vite build to dist/
npm start             # prisma db push + node server/index.js
```

## Code Style & Conventions

- **Formatting:** Prettier - 4 spaces, single quotes, semicolons, trailing commas, 120 char line width
- **Modules:** ES6 `import`/`export` everywhere (both client and server use `"type": "module"`)
- **Variables:** `const`/`let` only (`no-var` enforced), `prefer-const` warned
- **Equality:** `===` required (`eqeqeq` warned)
- **Naming:** camelCase for variables/functions, PascalCase for Prisma models
- **Unused variables:** Prefix with `_` to indicate intentional unused (e.g., `_unused`)
- **State pattern:** Centralized `gameState` object in `src/state.js` with getter/setter functions
- **Events:** Custom `EventEmitter` in `src/events.js` - use `gameEvents.emit(EVENT_NAME)` / `gameEvents.on(EVENT_NAME, handler)`
- **UI updates:** Event-driven DOM manipulation (no virtual DOM)
- **Shared code:** Game balance constants and stat formulas live in `shared/` to stay in sync between client and server

## Database Schema (Key Models)

- **User** - accounts, roles (user/moderator/admin), PvP stats (ELO rating, wins/losses)
- **GameState** - per-user game progress (equipment, gold, diamonds, forge level, combat wave, research, skills) stored as JSON fields
- **ItemTemplate** - equipment definitions (type, tier 1-7, skin, sprite references)
- **MonsterTemplate** - enemy definitions (wave, HP/damage multipliers, sprite)
- **PlayerTemplate** - player skin templates
- **SpriteSheet / Sprite** - asset coordinates for sprite-based rendering
- **ChatMessage** - persistent chat with channels
- **RefreshToken** - JWT refresh token rotation
- **Ban / Mute / Warning / AuditLog** - moderation system
- **Purchase** - Stripe payment records

## Game Systems

- **Equipment:** 8 slots (hat, armor, belt, boots, gloves, necklace, ring, weapon). Health items: hat/armor/belt/boots. Damage items: gloves/necklace/ring/weapon
- **Tier System:** 7 tiers (Common → Divine) with increasing bonus stats
- **Forge:** Players forge random equipment, forge level (1-30) gates tier availability
- **Combat (PvE):** Wave-based, sub-waves, tick-based loop at 100ms intervals
- **PvP:** Turn-based, actions are Attack/Defend/Special, ELO rating system, power-based matchmaking
- **Tech Tree:** Research system with queued research and essence costs
- **Skills:** Passive and active skills, up to 3 equipped, level-based unlocking
- **Shop:** Diamond packs via Stripe, milestone rewards

## API Structure

All REST routes are under `/api/`:
- `/api/auth/*` - registration, login, OAuth, token refresh, profile
- `/api/game/state` - GET/PUT game state
- `/api/equipment/templates` - public equipment data
- `/api/monsters/templates` - public monster data
- `/api/players/templates` - public player skins
- `/api/sprites` - public sprite data
- `/api/payment/*` - Stripe checkout and webhooks
- `/api/admin/*` - moderation (requires moderator/admin role)
- `/api/health` - health check

Socket.io events: `chat:*` (messaging, profiles), `pvp:*` (queue, combat turns), `admin:*` (kick, broadcast)

## Testing

Tests are in `src/__tests__/` using Vitest. Current test files cover:
- `state.test.js`, `state-research.test.js` - state management
- `combat.test.js`, `combat-techs.test.js` - combat mechanics
- `forge.test.js`, `forge-techs.test.js` - forging system
- `economy-techs.test.js` - economy balance
- `events.test.js` - event system
- `research.test.js`, `tech-config.test.js` - tech tree

Run `npm test` before committing. CI runs tests on all PRs to main.

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - random secrets for auth (required)
- `PORT` - server port (default: 3000)
- `NODE_ENV` - development or production
- `CORS_ORIGIN` - allowed origin for CORS
- `DISCORD_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` - OAuth (optional)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - payments (optional)
- `VITE_*` prefixed vars are exposed to the frontend

## CI/CD

- **CI (`.github/workflows/ci.yml`):** Runs on PRs to main - `npm test` + `npm run build`
- **Deploy (`.github/workflows/deploy.yml`):** Runs on push to main or `claude/*` branches - builds and deploys frontend to GitHub Pages
- **Railway:** Backend auto-deploys from main, uses `railway.json` for build/start config

## Key Patterns for AI Assistants

1. **Always run `npm test` after making changes** to verify nothing is broken
2. **Game balance values** are centralized in `shared/stats.js` and `src/config.js` - change there, not scattered through code
3. **New API routes** should follow the pattern in `server/routes/` - use `requireAuth` and `requireRole` middleware from `server/middleware/auth.js`
4. **New socket events** go in `server/socket/chat.js` or `server/socket/pvp.js` and must be registered in `server/socket/index.js`
5. **Frontend state changes** should go through `src/state.js` getters/setters, then emit events via `src/events.js`
6. **UI updates** are event-driven - listen for events in UI modules, never mutate DOM from state/logic modules
7. **Shared logic** between client and server belongs in `shared/` - keep stat formulas, equipment types, and PvP constants in sync
8. **Database changes** require updating `prisma/schema.prisma` then running `npm run db:push` or `npm run db:migrate`
9. **New CSS** should go in the appropriate modular file under `css/` (e.g., `css/combat.css` for combat styling)
10. **Translations** - if adding user-visible text, add keys to all locale files in `src/i18n/`
11. **Admin features** need both a REST endpoint (in `server/routes/admin.js`) and UI (in `src/ui/admin-ui.js` + `admin.html`)
12. **The Vite dev server proxies `/api` and `/socket.io`** to port 3000 - run both `npm run dev` and `npm run dev:server` during development
