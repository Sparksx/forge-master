// Clan activity templates + resolution math — shared by client (UI) and server
// (creation, validation, reward computation). Expeditions are timed cooperative
// runs; missions are play-tracked clan goals. Both pay clan XP.

const HOUR = 3600 * 1000;

// ── Expeditions ─────────────────────────────────────────────────────────────
// Each registered member contributes their gear power toward `powerReq`. A full
// roster that meets the power requirement is a guaranteed success; a thinner or
// weaker party still has a shot, with reward scaled to how well it did.
//
// Launching is FREE — no gold gate (that would be pay-to-win). Access is gated
// instead by `minClanLevel` (harder runs unlock as the clan grows via cooperative
// XP) and by a per-clan cap on concurrently active runs (see maxActiveExpeditions).
//
// Slots scale with clan size (expeditionSlots) so more members can collaborate;
// the launcher also picks a duration, and both the XP and the gold POT scale with
// that duration (expeditionReward). The gold pot is SPLIT across everyone who
// joins — more participants means a thinner per-head share, not more minted gold.
// `powerPerSlot` keeps difficulty proportional to the (variable) party size.
export const EXPEDITIONS = [
    { key: 'patrol', name: 'Border Patrol', difficulty: 'Easy', minClanLevel: 1, powerPerSlot: 3000, xpPerHour: 400, goldPerHour: 6 },
    { key: 'ruins', name: 'Lost Ruins', difficulty: 'Normal', minClanLevel: 3, powerPerSlot: 8000, xpPerHour: 450, goldPerHour: 10 },
    { key: 'caverns', name: 'Frost Caverns', difficulty: 'Hard', minClanLevel: 6, powerPerSlot: 15000, xpPerHour: 550, goldPerHour: 15 },
    { key: 'lair', name: "Dragon's Lair", difficulty: 'Epic', minClanLevel: 10, powerPerSlot: 28000, xpPerHour: 700, goldPerHour: 22 },
];

const EXPEDITION_BY_KEY = Object.fromEntries(EXPEDITIONS.map((e) => [e.key, e]));

export function expeditionDef(key) {
    return EXPEDITION_BY_KEY[key] || null;
}

// Launcher-chosen run length (whole hours) and the party-size band slots clamp to.
export const EXPEDITION_MIN_HOURS = 1;
export const EXPEDITION_MAX_HOURS = 12;
export const EXPEDITION_MIN_SLOTS = 2;
export const EXPEDITION_MAX_SLOTS = 10;

/** Clamp a requested run length to the allowed whole-hour range. */
export function clampExpeditionHours(hours) {
    const h = Math.floor(Number(hours));
    if (!Number.isFinite(h)) return EXPEDITION_MIN_HOURS;
    return Math.max(EXPEDITION_MIN_HOURS, Math.min(EXPEDITION_MAX_HOURS, h));
}

// Longer commitments pay better PER HOUR, so there's a real reason to run one long
// expedition instead of spamming short ones. Reward = rate · hours · bonus, where
// bonus rises linearly from 1× at the minimum length to (1 + DURATION_BONUS)× at the
// maximum — making total reward grow super-linearly with the chosen duration.
const DURATION_BONUS = 1.0; // up to +100% per-hour efficiency at the longest run

export function expeditionDurationMultiplier(hours) {
    const h = clampExpeditionHours(hours);
    const span = EXPEDITION_MAX_HOURS - EXPEDITION_MIN_HOURS;
    const t = span > 0 ? (h - EXPEDITION_MIN_HOURS) / span : 0;
    return 1 + DURATION_BONUS * t;
}

/** Available slots for a clan of `memberCount`, clamped to the collaboration band. */
export function expeditionSlots(memberCount) {
    const n = Math.floor(Number(memberCount) || 0);
    return Math.max(EXPEDITION_MIN_SLOTS, Math.min(EXPEDITION_MAX_SLOTS, n));
}

/**
 * Concrete run parameters for launching `def` over `hours` with `slots` seats.
 * Reward grows super-linearly with duration (longer runs pay better per hour, see
 * expeditionDurationMultiplier); `rewardGold` is the total pot (split per
 * participant on resolve) and is deliberately a small trickle to fit the scarce
 * gold economy, `rewardXp` is the clan-wide grant, and `powerReq` scales with
 * party size so a bigger party isn't automatically a walkover.
 */
export function expeditionPlan(def, hours, slots) {
    const h = clampExpeditionHours(hours);
    const mult = expeditionDurationMultiplier(h);
    return {
        durationMs: h * HOUR,
        hours: h,
        slots,
        rewardXp: Math.round(def.xpPerHour * h * mult),
        rewardGold: Math.round(def.goldPerHour * h * mult),
        powerReq: def.powerPerSlot * slots,
    };
}

/**
 * How many expeditions a clan may have running at once. Grows with clan level so
 * progression (cooperative XP, not gold) unlocks more parallel runs. Always ≥ 1.
 */
export function maxActiveExpeditions(clanLevel) {
    return 1 + Math.floor(Math.max(1, clanLevel) / 5); // L1:1, L5:2, L10:3, … L30:7
}

/**
 * Resolve an expedition outcome. Combines registered party power vs the requirement
 * and how full the roster is into a 0..1 score; success is rolled against it (a
 * caller-provided `rng` in [0,1) keeps this deterministic/testable). Reward is
 * scaled by the score so a marginal win pays less than a dominant one.
 *
 * Returns { score, success, rewardMult } where rewardMult ∈ [0,1].
 */
export function expeditionOutcome(def, { totalPower, filledSlots }, rng = 0) {
    if (!def || filledSlots <= 0) return { score: 0, success: false, rewardMult: 0 };
    const powerScore = Math.min(1, totalPower / Math.max(1, def.powerReq));
    const fillScore = Math.min(1, filledSlots / def.slots);
    // Power is the dominant factor; a full roster gives a steady bump.
    const score = Math.min(1, powerScore * 0.7 + fillScore * 0.3);
    const success = rng < score;
    // Even a failed run salvages a fraction; a win pays out scaled by score.
    const rewardMult = success ? Math.max(0.5, score) : score * 0.25;
    return { score, success, rewardMult };
}

// ── Missions ──────────────────────────────────────────────────────────────────
// `type` maps to client gameplay events (see src/game/clan-missions.js).
export const MISSIONS = [
    { key: 'forge_spree', name: 'Forge Spree', desc: 'Forge 250 items together', type: 'forge_count', target: 250, rewardXp: 800 },
    { key: 'monster_hunt', name: 'Monster Hunt', desc: 'Defeat 1,500 enemies', type: 'defeat_enemies', target: 1500, rewardXp: 1000 },
    { key: 'boss_slayers', name: 'Boss Slayers', desc: 'Win 30 boss fights', type: 'win_bosses', target: 30, rewardXp: 1200 },
    { key: 'fresh_look', name: 'Fresh Look', desc: 'Members swap their full gear set 15 times', type: 'swap_all_gear', target: 15, rewardXp: 700 },
    { key: 'climbers', name: 'Arena Climbers', desc: 'Clear 200 arena stages', type: 'reach_arena', target: 200, rewardXp: 900 },
];

const MISSION_BY_KEY = Object.fromEntries(MISSIONS.map((m) => [m.key, m]));

export function missionDef(key) {
    return MISSION_BY_KEY[key] || null;
}

export const MISSION_TYPES = MISSIONS.map((m) => m.type);

// Per-request cap on reported mission progress (basic anti-cheat; the game already
// trusts the client for gold/XP, so this just bounds the blast radius of a bad client).
export const MISSION_PROGRESS_MAX_PER_REPORT = 50;
