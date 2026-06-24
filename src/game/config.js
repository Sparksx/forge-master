// Game constants for Gear Master: Reforged.
// Item stat math + tiers live in shared/stats.js (single source of truth, shared
// with the server). This file holds the client-side game-design knobs.

export {
    EQUIPMENT_TYPES, HEALTH_ITEMS, DAMAGE_ITEMS,
    TIERS, MAX_TIER, BONUS_STATS, BONUS_STAT_KEYS,
    MAX_PLAYER_LEVEL, playerBaseHealth, playerBaseDamage, playerPowerScore,
    calculateItemStats, calculateStats, calculatePowerScore, computeStatsFromEquipment,
    BASE_ATTACK_PERIOD, MAX_BATTLE_SECONDS, ATTACK_STYLES, RANGED_OPENING_FRACTION,
    weaponStyle,
} from '../../shared/stats.js';

export const SAVE_KEY = 'fm_reforged_save';
export const MAX_ITEM_LEVEL = 100;

// Emoji per slot (visual fallback; sprite art can override later).
export const SLOT_ICONS = {
    weapon: '⚔️', armor: '🛡️', hat: '🪖', gloves: '🧤',
    boots: '🥾', belt: '🎗️', necklace: '📿', ring: '💍',
};

export const SLOT_LABELS = {
    weapon: 'Weapon', armor: 'Armor', hat: 'Helm', gloves: 'Gloves',
    boots: 'Boots', belt: 'Belt', necklace: 'Amulet', ring: 'Ring',
};

// Forge: instant gold upgrades that improve rarity odds. NO real-time timers.
// chances = [Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine] (sum 100).
export const FORGE_LEVELS = [
    { cost: 0,        chances: [100,  0,    0,    0,    0,    0,   0] },
    { cost: 300,      chances: [90,   10,   0,    0,    0,    0,   0] },
    { cost: 1200,     chances: [78,   18,   4,    0,    0,    0,   0] },
    { cost: 4000,     chances: [66,   22,   10,   2,    0,    0,   0] },
    { cost: 12000,    chances: [54,   24,   15,   6,    1,    0,   0] },
    { cost: 32000,    chances: [42,   24,   19,   11,   4,    0,   0] },
    { cost: 80000,    chances: [32,   22,   21,   16,   8,    1,   0] },
    { cost: 200000,   chances: [22,   19,   22,   20,   14,   3,   0] },
    { cost: 480000,   chances: [14,   15,   21,   23,   20,   6,   1] },
    { cost: 1100000,  chances: [8,    11,   18,   24,   25,   12,  2] },
    { cost: 2600000,  chances: [3,    7,    14,   23,   30,   18,  5] },
    { cost: 6000000,  chances: [0,    3,    10,   20,   33,   24,  10] },
];
export const MAX_FORGE_LEVEL = FORGE_LEVELS.length;

// ── Forge XP ────────────────────────────────────────────────────────────────
// Each forge grants XP toward the next forge level, so forging more makes the
// forge stronger on its own. XP is rarity-weighted: a Common roll grants 1, a
// Divine grants 7 — rarer rolls advance the forge faster. The gold-cost upgrades
// in FORGE_LEVELS still work as an optional way to buy the next level instantly.

/** Forge XP granted for forging an item of the given rarity tier (Common=1 … Divine=7). */
export function forgeXpForRarity(tier) {
    return Math.max(1, Math.floor(tier));
}

/** Average forge XP per forge at a given forge level, from its rarity odds. */
function avgForgeXp(level) {
    const chances = FORGE_LEVELS[Math.min(level, MAX_FORGE_LEVEL) - 1].chances;
    return chances.reduce((sum, c, i) => sum + c * forgeXpForRarity(i + 1), 0) / 100;
}

/** XP needed to advance the forge FROM `level` to level+1 (null once maxed). */
export function forgeXpForLevel(level) {
    if (level >= MAX_FORGE_LEVEL) return null;
    // Base "forges needed" curve, scaled by the average rarity XP at this level
    // so the expected number of forges per level matches a flat-1-XP pacing —
    // rarity weighting then adds upside variance, not faster overall leveling.
    const baseForges = 8 + (level - 1) * 6 + Math.floor(Math.pow(level, 2.1));
    return Math.max(1, Math.round(baseForges * avgForgeXp(level)));
}

// ── Player XP ───────────────────────────────────────────────────────────────
// Defeating arena enemies grants player XP. Levelling up raises only base HP and
// base attack (math in shared/stats.js); other base stats stay fixed.

/** XP needed to advance the player FROM `level` to level+1. */
export function playerXpForLevel(level) {
    return Math.floor(50 * Math.pow(Math.max(1, level), 1.5));
}

/** XP awarded for defeating an arena enemy at the given rank. */
export function arenaXp(rank) {
    return Math.round(8 * Math.pow(rank, 0.85)) + 6;
}

// Forge a fresh item near this level band until the player has gear to scale from.
export const INITIAL_LEVEL_MAX = 8;
export const LEVEL_BAND = 12; // new rolls land within ±band of your best for that slot

// Arena (PvE ladder): enemy power scales with rank; rewards scale too.
export const ARENA_BASE_POWER = 45;
export const ARENA_POWER_GROWTH = 1.16;
export const ARENA_BASE_REWARD = 20;

export function arenaEnemyPower(rank) {
    return Math.round(ARENA_BASE_POWER * Math.pow(ARENA_POWER_GROWTH, rank - 1));
}

export function arenaReward(rank) {
    return Math.round(ARENA_BASE_REWARD * Math.pow(rank, 1.25)) + 10;
}

// ── Encounters: who you face at a given rank ─────────────────────────────────
// Home mode is 1 hero vs a *group* of enemies. The group is pre-generated and
// deterministic per rank (same rank → same line-up). A regular rank fields a
// small pack of minions; every 10th rank is a Boss and every 50th a Big Boss.
export const BOSS_INTERVAL = 10;
export const BIG_BOSS_INTERVAL = 50;

// How much of the rank's power budget the lead enemy carries, and the share
// each escort minion gets. Tuned so an encounter's *total* threat tracks the
// old single-enemy curve, with bosses a deliberate spike.
export const BOSS_LEAD_SHARE = 1.45;       // boss core power, ×arenaEnemyPower
export const BIG_BOSS_LEAD_SHARE = 2.3;    // big-boss core power, ×arenaEnemyPower
export const ESCORT_SHARE = 0.28;          // each boss escort, ×arenaEnemyPower
export const MAX_GROUP = 4;                 // never spawn more than this at once

/** Boss / big-boss / normal classification for a rank. */
export function rankKind(rank) {
    if (rank % BIG_BOSS_INTERVAL === 0) return 'bigboss';
    if (rank % BOSS_INTERVAL === 0) return 'boss';
    return 'normal';
}

// Tiny deterministic PRNG (mulberry32) so encounters are stable per rank without
// storing them — "pre-generated" purely as a function of the rank seed.
export function seededRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Stage display: group ranks into "chapters" of substages, so the ladder reads
// like the inspiration games ("Hard 2-15"). Purely cosmetic over arenaRank.
export const STAGES_PER_CHAPTER = 10;

export function stageInfo(rank) {
    const chapter = Math.floor((rank - 1) / STAGES_PER_CHAPTER) + 1;
    const sub = ((rank - 1) % STAGES_PER_CHAPTER) + 1;
    return {
        chapter,
        sub,
        label: `Hard ${chapter}-${sub}`,
        progress: sub / STAGES_PER_CHAPTER, // 0..1 within the current chapter
    };
}

// Cost to found a clan (deducted from gold, client-side).
export const CLAN_CREATE_COST = 5000;

// Avatar choices (emoji).
export const AVATARS = [
    { id: 'wizard', emoji: '🧙' }, { id: 'knight', emoji: '⚔️' },
    { id: 'warrior', emoji: '🛡️' }, { id: 'elf', emoji: '🧝' },
    { id: 'vampire', emoji: '🧛' }, { id: 'dragon', emoji: '🐉' },
    { id: 'skull', emoji: '💀' }, { id: 'fire', emoji: '🔥' },
    { id: 'crown', emoji: '👑' }, { id: 'gem', emoji: '💎' },
    { id: 'wolf', emoji: '🐺' }, { id: 'robot', emoji: '🤖' },
];

export function avatarEmoji(id) {
    return (AVATARS.find((a) => a.id === id) || AVATARS[0]).emoji;
}
