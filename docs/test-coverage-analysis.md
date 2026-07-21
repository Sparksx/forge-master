# Test Coverage Analysis

**Date:** 2026-07-21
**Current state:** 28 test files, 524 passing tests, covering 21 of 50 source modules (42%).

## Coverage by layer

| Layer | Tested | Total | Coverage |
|---|---|---|---|
| `shared/` | 5 | 6 | 83% |
| `src/game/` | 8 | 13 | 62% |
| `server/routes/` | 3 (helpers only) | 9 | 33% |
| `server/lib + middleware` | 2 | 7 | 29% |
| `server/socket/` | 1 (helpers only) | 2 | 50% |
| `src/screens/` | 1 (`fmt` only) | 14 | 7% |

## What's well covered

- **Shared game math** — `stats.js`, `combat.js`, `clan-config.js`, `clan-activities.js`, `cosmetics.js`, `clan-ranks.js` all have deep tests covering formulas, edge cases, and anti-cheat invariants.
- **Core client game logic** — forge odds, arena encounters, state management, progression curves, items, chat, and auto-forge all have dedicated suites.
- **Server-side anti-cheat** — `state-validation.js` rejects fabricated stats, inflated bonuses, and bogus items.
- **Economy invariants** — gold scarcity, cosmetics-grant-zero-power, pack volume discounts, and rarity caps are asserted as contracts.

## Recommended improvements

### Critical — security & money

#### 1. `server/middleware/auth.js` (6 exports, 0 tests)

JWT verification, role-based access control, ban/mute enforcement, and socket auth. Every protected endpoint depends on this module.

**What to test:**
- `requireAuth` — rejects missing header, malformed Bearer, expired token, invalid signature; accepts valid token and attaches `req.user`
- `requireRole` — rejects insufficient roles, accepts permitted roles, handles missing user in DB
- `socketAuth` — mirrors token validation for Socket.io handshakes
- Testable with mock `req`/`res`/`next` and a test JWT secret — no DB needed

#### 2. `server/routes/payment.js` (5 endpoints, 0 tests)

Stripe Checkout session creation, idempotent purchase confirmation, webhook signature verification, and gold crediting. Real money flows here.

**What to test:**
- Confirm endpoint: idempotent crediting (same session_id twice grants gold once), rejects unknown/unpaid sessions, floors gold to integer
- Webhook: rejects invalid Stripe signatures, marks completed purchases
- Mock Prisma client and stub Stripe SDK

#### 3. `server/routes/game.js` (2 endpoints, 0 tests)

GET/PUT for the entire player game state — the save/load boundary. PUT runs 10+ validators but none are tested in integration.

**What to test:**
- PUT rejects each invalid field type with 400 (equipment, gold, combat, forgeLevel, player, etc.)
- PUT accepts valid partial updates
- GET creates default state for new players
- GET returns all expected fields
- Gold is floored to integer on save, forgeLevel clamped to `MAX_FORGE_LEVEL`

### High — core game features

#### 4. `src/game/clan-missions.js` (1 export, 5 internal fns, 0 tests)

Watches gameplay events, debounce-batches progress, flushes to API in clamped chunks. A flush bug silently breaks mission tracking for every clan member.

**What to test:**
- `bump()` ignores zero/negative amounts, bails when not in a clan
- `flush()` sends clamped chunks of `MISSION_PROGRESS_MAX_PER_REPORT`, drops inactive types, reschedules on partial network failure, triggers clan refresh on completion
- Swap-all-gear detection fires only after every slot type has been equipped
- Use `vi.useFakeTimers()` to control the 8s debounce; mock `clan.js` API calls

#### 5. `src/game/clan.js` (21 exports, 0 tests)

Every clan REST call — create, join, leave, promote, demote, kick, transfer, expeditions, missions.

**What to test:**
- Cache layer: `getMyClanCached` returns stale data before refresh, fresh after
- `canUseClans` reflects auth state
- `loadMyClan` clears cache on 404 (left/kicked)
- API functions pass correct method/body to `apiFetch` — mock the fetch layer

#### 6. `src/game/pvp.js` (3 exports, 0 tests)

Client PvP fight initiation, leaderboard fetch, player profile fetch.

**What to test:**
- `pvpFight` sends equipment and returns structured fight result
- `pvpLeaderboard` returns array on success, empty array on failure
- `fetchPlayerProfile` handles 404 gracefully

#### 7. `server/routes/auth.js` (13 endpoints, 0 tests)

Registration, login, guest accounts, OAuth, token refresh, logout, username changes. The entire identity layer.

**What to test:**
- `POST /register` — rejects duplicate usernames, short passwords, empty fields; creates user with hashed password
- `POST /login` — rejects wrong password, returns access + refresh tokens
- `POST /refresh` — rotates refresh token, rejects expired/revoked
- `POST /guest` — creates anonymous user with unique name
- `POST /change-username` — rejects taken names, enforces length limits

### Medium — UI logic & remaining server

#### 8. `src/screens/item-view.js` (6 exports, 0 tests)

Pure functions for stat labels, power deltas, bonus rendering, item comparison grids. Most testable screen module.

**What to test:**
- `statTypeLabel` returns "Health" for health items, "Damage" otherwise
- `powerDelta` correctly computes current vs. hypothetical power (mock `getEquipment`)
- `renderItemComparison` includes rows for every bonus on either item, correct delta signs

#### 9. `src/screens/components.js` (9 exports, only `fmt` tested)

The `h()` DOM factory, `toast()`, `openModal`/`closeModal`, `confirmDialog` are all untested.

**What to test:**
- `h()` — creates correct element types, applies className/style/text, appends children, handles null children
- Use jsdom or happy-dom Vitest environment

#### 10. `src/game/shop.js` (4 exports, 0 tests)

Stripe checkout flow and the critical `reconcileCheckoutReturn()`.

**What to test:**
- Returns null when no `?payment` param
- Cleans URL params after processing
- Returns `{ status: 'error', granted: 0 }` on failure
- Calls `loadFromServer` and emits `GOLD_PURCHASED` on success
- Mock `window.location`, `window.history`, `apiFetch`

#### 11. `server/routes/admin.js` (19 endpoints, only `parseDuration` tested)

The entire moderation system — warn, mute, ban, kick, gold adjustment, role change, state reset, audit log.

**What to test:**
- Each action creates correct DB record and audit log entry
- Ban sets correct expiry and active flag
- State reset clears game state without deleting the user
- Gold credit is audit-logged

#### 12. `src/game/admin.js` (18 exports, 0 tests)

Client-side moderation API calls. Thin wrappers but shape tests catch regressions.

**What to test:**
- Each function sends correct HTTP method, path, and body
- `searchUsers` encodes query params correctly
- `banUser`/`muteUser` pass duration and reason

## Approach

The existing test suite uses Vitest with no DOM environment — pure function imports. This pattern extends naturally to all critical and high-priority items above.

**For server route tests:** continue the extract-and-unit-test pattern already used in `clans.js`, `pvp.js`, and `admin.js` (export helpers, test them directly). For payment and game-state endpoints where the full request-validation-response flow matters, consider supertest integration tests with a mocked Prisma client.

**For UI-layer tests:** add `happy-dom` as a Vitest environment for `item-view.js` and `components.js` files.

**Estimated impact:** The 7 modules in the critical + high tiers would add roughly 50-80 test cases covering auth bypasses, payment double-crediting, state corruption, and clan mission tracking — the paths where bugs cost the most.
