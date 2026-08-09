# Test Coverage Analysis — Gear Master

**Date:** 2026-07-24
**Scope:** All test files under `src/`, `shared/`, and `server/`

---

## Current State

The codebase has **28 test files** with approximately **492 tests**, all run via
Vitest. Coverage concentrates on pure-function game logic and data validation;
route handlers, socket event handlers, middleware, and UI rendering have little
to no automated testing.

### What's well-covered

| Area | Files | ~Tests | Notes |
|---|---|---|---|
| State validation / anti-cheat | 2 | 32 | Thorough boundary + injection (NaN, Infinity, fabricated stats) |
| Game state management | 3 | 90 | Gold ops, equip, leveling, perks, cosmetics, save/load |
| Combat engine | 2 | 35 | Determinism, all stat effects, double-hit, reflect, execute |
| Forge mechanics | 2 | 21 | Tier rolling, item creation, gold drops, best-of-N |
| Progression curves | 2 | 45 | Forge XP/rarity tables, arena scaling, player XP |
| Item presentation | 1 | 25 | Name generation, icons, labels, bonus formatting |
| Clan math & config | 4 | 47 | Ranks, perks, expedition/mission templates, XP curve |
| Cosmetics catalog | 2 | 13 | Catalog integrity, non-pay-to-win invariant |
| PvP matchmaking | 1 | 7 | pickOpponent + Elo delta |
| Route helper functions | 3 | 80 | Serializers, field validation, fighter construction |
| Chat helpers | 1 | 26 | Elo rank, frame, serialization, combat log store |
| Arena maps | 1 | 10 | Layout definitions, pathfinding (flood-fill) |
| Auto-forge filters | 1 | 7 | Trash/keep policy |
| Event bus | 1 | 4 | on/off/emit, fault isolation |
| `fmt` number formatter | 1 | 18 | k/M/B ranges, negatives, edge cases |
| Gold packs config | 1 | 5 | Volume discount monotonicity, key whitelist |

### Testing strengths

- **Anti-cheat focus:** Many tests deliberately inject cheat vectors (fabricated stats,
  over-cap values, Infinity/NaN) and verify rejection.
- **Determinism:** Combat uses seeded RNG; tests verify byte-identical replays.
- **Statistical validation:** Some tests run 40–600 iterations for probabilistic properties.
- **Non-mutation checks:** Several tests verify functions don't mutate inputs.
- **Pathfinding verification:** Arena layout test runs a flood-fill to confirm spawn
  accessibility.

---

## Coverage Gaps (ranked by risk)

### 1. Payment & Stripe Integration — **CRITICAL**

**Untested module:** `server/routes/payment.js`

Real money flows through this code. None of the following are tested:

- **Checkout session creation** — validates pack ID, creates Stripe session
- **Payment confirmation** — idempotent gold crediting (`pending → completed` flip)
- **Webhook handler** — Stripe signature verification, `checkout.session.completed`,
  `charge.refunded` (gold clawback)
- **Purchase history** — retrieval and formatting
- **Edge cases:** duplicate confirmation attempts, invalid pack IDs, webhook replay,
  refund when user has already spent the gold

**Why it matters:** A bug here loses real money or grants unbounded gold. The
idempotent crediting logic (`creditPurchase`) and refund clawback are the most
critical paths in the entire app.

**Recommended tests:**
- Unit-test `creditPurchase` with mocked Prisma (happy path, already-completed, missing purchase)
- Test webhook signature rejection and event routing
- Test refund clawback (positive balance, insufficient balance)
- Test `create-checkout-session` with invalid/missing pack IDs
- Integration test: full checkout → confirm → verify gold credited exactly once

---

### 2. Authentication & Authorization — **CRITICAL**

**Untested modules:** `server/routes/auth.js`, `server/middleware/auth.js`

Every protected endpoint depends on these. No tests exist for:

- **JWT generation & validation** — access tokens, refresh tokens, expiry
- **Refresh token rotation** — old token deleted, new issued atomically; replay of
  revoked tokens rejected
- **Registration** — input validation (username length, email format, password strength),
  duplicate detection, bcrypt hashing
- **Login** — by username or email, password verification, wrong-password rejection
- **Guest accounts** — creation, username generation, later linking
- **OAuth flows** — Discord/Google code exchange, find-or-create, account linking
- **`requireAuth` middleware** — missing/expired/malformed tokens, user attachment to `req`
- **`requireRole` middleware** — role escalation, missing user in DB
- **Ban/mute enforcement** — `getActiveBan` / `getActiveMute` with permanent vs. expiring
- **Socket auth** — JWT from handshake, rejection of invalid tokens

**Why it matters:** Auth bugs can expose all player data, allow impersonation, or
lock out legitimate users. The refresh-token rotation is a classic source of
race-condition bugs.

**Recommended tests:**
- Unit-test `requireAuth` with valid/expired/missing/malformed tokens (mock `jsonwebtoken`)
- Unit-test `requireRole` with matching/non-matching/missing roles
- Test `getActiveBan` with permanent, expired, and future-expiry bans
- Test registration validation (boundary: username 2 vs 3 chars, password 5 vs 6)
- Test refresh-token rotation atomicity (old token rejected after rotation)
- Test guest creation and Discord/Google linking flows

---

### 3. Game State Save/Load Endpoint — **HIGH**

**Untested module:** `server/routes/game.js`

The `PUT /api/game/state` handler orchestrates all the validation functions that
*are* unit-tested, but the handler itself is not tested. Gaps:

- **Selective field saving** — only validated fields are written; unknown fields ignored
- **Validation → rejection flow** — does a bad equipment payload actually return 400?
- **Auto-creation** — GET on a user with no state creates a default
- **Concurrent saves** — last-write-wins behavior or race conditions?
- **Payload size limits** — can a client send an absurdly large state?

**Recommended tests:**
- Integration test: save with valid state → load → verify round-trip
- Test that invalid equipment in PUT body returns 400 and does NOT persist
- Test auto-creation on first GET
- Test unknown fields are silently dropped

---

### 4. Server-Side PvP Fight Resolution — **HIGH**

**Untested handler:** `POST /api/pvp/fight` in `server/routes/pvp.js`

The helper functions (`fighterFromUser`, `pickOpponent`, `mirrorBot`) are
well-tested, but the endpoint that wires them together is not:

- **Matchmaking integration** — does it actually query recent players and pick correctly?
- **Elo update persistence** — are ratings written to DB after the fight?
- **Self-fight prevention** — can a player fight themselves?
- **Friendly duel mode** — does `opponentId` bypass matchmaking correctly?
- **Mirror bot fallback** — when no opponents exist, is the bot stats correct?
- **Rate limiting** — can a player spam fights?

**Recommended tests:**
- Test fight resolution writes new Elo to both players
- Test that no-opponent scenario produces a mirror bot fight
- Test friendly duel with a specific opponentId
- Test self-fight rejection

---

### 5. Clan Route Handlers — **HIGH**

**Untested handlers in:** `server/routes/clans.js`

The serializers and validators are tested, but the handlers are not:

- **Create clan** — gold deduction, name/tag uniqueness, DB creation
- **Join/leave** — member cap enforcement, auto-disband on last member leaving,
  ownership transfer on leader leaving
- **Expedition lifecycle** — start (level gate, concurrency cap), join (slot cap),
  lazy resolve on read, gold pot distribution, cancel
- **Mission lifecycle** — start, progress clamping, lazy completion, XP grant
- **Rank management** — permission checks wired correctly in handlers
- **Treasury contribution** — transactional gold deduction

**Recommended tests:**
- Test create → join → leave lifecycle with member cap edge case
- Test expedition start respects `minClanLevel` and `maxActiveExpeditions`
- Test expedition resolve distributes gold and XP correctly
- Test mission completion grants clan XP
- Test rank permission enforcement end-to-end (member tries to kick officer → 403)

---

### 6. Socket Event Handlers — **MEDIUM-HIGH**

**Untested:** `server/socket/chat.js` event handlers, `server/socket/index.js`

Only the exported helper functions are tested. The actual socket event handler
logic is not:

- **Message sending** — cooldown enforcement (1.5s), mute check, channel authorization
- **Channel resolution** — `general` / `clan` / `conv:<id>` routing and authorization
- **History replay** — last 100 messages on join
- **DM creation** — find-or-create conversation
- **Group creation** — member limit (20), name validation
- **Message deletion** — admin/moderator authorization, audit logging
- **Combat sharing** — broadcast to channel, TTL store

**Recommended tests:**
- Test message cooldown enforcement (second message within 1.5s rejected)
- Test muted user cannot send messages
- Test channel authorization (user can't post to another clan's channel)
- Test DM creation and conversation listing

---

### 7. Client Modules with Business Logic — **MEDIUM**

**Untested:**

| Module | Key untested logic |
|---|---|
| `src/game/shop.js` | Checkout flow, reconciliation after Stripe return |
| `src/game/clan.js` | Cache invalidation, perk synchronization after load |
| `src/game/clan-missions.js` | Event-driven progress batching, debounced flush, clamping |
| `src/game/pvp.js` | Fight request, profile fetch, leaderboard |
| `src/game/admin.js` | All admin API wrappers |
| `src/api.js` | Token refresh on 401, retry logic |
| `src/auth.js` | Login/register/OAuth client flows |

The most impactful to test would be:

- **`clan-missions.js`** — the batching/debounce/clamp logic is non-trivial and
  testable in isolation (mock the event bus and apiFetch)
- **`shop.js` reconciliation** — the `reconcileCheckoutReturn` flow that syncs
  Stripe-granted gold back into local state
- **`api.js` token refresh** — the 401 → refresh → retry cycle is a common source
  of bugs

---

### 8. UI / Screen Rendering — **MEDIUM**

**Untested:** All of `src/screens/` except the `fmt` formatter.

These are vanilla JS DOM-building modules using the `h()` helper. Testing them
doesn't require a framework, but does need a DOM environment (jsdom or happy-dom).

**Highest-value targets:**

- **`app.js` routing** — does `navigateTo('pvp')` mount the right screen and update
  the nav indicator?
- **`home.js` forge/arena interaction** — does forging update the grid? Does
  equipping update power display?
- **`components.js`** — `h()` helper, `itemCard()`, `powerDelta()`, modal show/hide
  (only `fmt` is tested today)
- **`item-view.js`** — item comparison rendering, stat display accuracy

**Recommended approach:** Add `happy-dom` to the Vitest config for a lightweight
DOM environment. Start with `components.js` — the `h()` helper is the foundation
for all rendering and has zero tests.

---

### 9. Admin Moderation Endpoint Handlers — **MEDIUM**

**Untested handlers in:** `server/routes/admin.js` (only `parseDuration` is tested)

- **User search** — query sanitization, result format
- **Warn/mute/ban** — duration parsing (tested), but DB writes, permission
  enforcement (moderator time caps), and audit logging are not
- **Gold/level adjustments** — amount validation, DB update, negative gold prevention
- **State reset** — full wipe without leaving orphan records
- **Stats endpoint** — aggregation query correctness
- **Broadcast** — system message delivery and audit

**Recommended tests:**
- Test moderator cannot issue permanent ban (only admin can)
- Test moderator mute capped at 24h
- Test gold adjustment with negative amount doesn't go below zero
- Test audit log creation on each moderation action

---

### 10. Database Seeding & Migration — **LOW**

**Untested:** `server/lib/seed-equipment.js`, `server/lib/migrate-sprites.js`

These are run-once operations. Lower priority, but a broken seed means fresh
deployments fail silently.

**Recommended tests:**
- Test `seedEquipmentIfEmpty` is idempotent (running twice doesn't duplicate)
- Test `migrateSpritesIfNeeded` is idempotent

---

## Summary: Priority Matrix

| Priority | Area | Risk if untested | Effort |
|---|---|---|---|
| **P0** | Payment / Stripe | Financial loss, gold duplication | Medium |
| **P0** | Auth / middleware | Account takeover, data exposure | Medium |
| **P1** | Game state save/load | Data corruption, cheat bypass | Low |
| **P1** | PvP fight endpoint | Rating manipulation | Low-Medium |
| **P1** | Clan handlers | Gold duplication via treasury, perk exploits | Medium |
| **P2** | Socket chat handlers | Spam, unauthorized access | Medium |
| **P2** | Client business logic (missions, shop, api) | Silent failures, lost progress | Low-Medium |
| **P2** | UI components | Rendering regressions | Medium |
| **P3** | Admin moderation handlers | Privilege escalation | Low |
| **P3** | DB seeding/migration | Broken fresh deploys | Low |

## Quick Wins (highest value per effort)

1. **`creditPurchase` unit test** — mock Prisma, test the `pending→completed` idempotency
   in 5 test cases. Protects real money.
2. **`requireAuth` middleware test** — mock `jsonwebtoken`, 4 cases (valid/expired/missing/malformed).
   Protects every endpoint.
3. **`clan-missions.js` batching test** — mock events + API, verify debounce + clamp logic.
   Pure JS, no DB needed.
4. **Game state round-trip test** — save → load with mocked Prisma, verify nothing is lost
   or mutated.
5. **`h()` helper test** — add happy-dom, test the DOM builder that every screen depends on.
