// Clan activity templates + resolution math — shared by client (UI) and server
// (creation, validation, reward computation). Expeditions are timed cooperative
// runs; missions are play-tracked clan goals. Both pay clan XP.

const HOUR = 3600 * 1000;

// ── Expeditions ─────────────────────────────────────────────────────────────
// Each registered member contributes their gear power toward `powerReq`. A full
// roster that meets the power requirement is a guaranteed success; a thinner or
// weaker party still has a shot, with reward scaled to how well it did.
export const EXPEDITIONS = [
    { key: 'patrol', name: 'Border Patrol', difficulty: 'Easy', slots: 2, durationMs: 1 * HOUR, rewardXp: 400, rewardGold: 150, powerReq: 6000, costGold: 100 },
    { key: 'ruins', name: 'Lost Ruins', difficulty: 'Normal', slots: 3, durationMs: 4 * HOUR, rewardXp: 1400, rewardGold: 500, powerReq: 24000, costGold: 300 },
    { key: 'caverns', name: 'Frost Caverns', difficulty: 'Hard', slots: 4, durationMs: 6 * HOUR, rewardXp: 2800, rewardGold: 900, powerReq: 60000, costGold: 600 },
    { key: 'lair', name: "Dragon's Lair", difficulty: 'Epic', slots: 5, durationMs: 8 * HOUR, rewardXp: 5000, rewardGold: 1600, powerReq: 140000, costGold: 1000 },
];

const EXPEDITION_BY_KEY = Object.fromEntries(EXPEDITIONS.map((e) => [e.key, e]));

export function expeditionDef(key) {
    return EXPEDITION_BY_KEY[key] || null;
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
