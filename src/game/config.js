// Game constants for Gear Master: Reforged.
// Item stat math + tiers live in shared/stats.js (single source of truth, shared
// with the server). This file holds the client-side game-design knobs.

export {
    EQUIPMENT_TYPES, HEALTH_ITEMS, DAMAGE_ITEMS,
    TIERS, MAX_TIER, BONUS_STATS, BONUS_STAT_KEYS,
    MAX_PLAYER_LEVEL, playerBaseHealth, playerBaseDamage, playerPowerScore,
    calculateItemStats, calculateStats, calculatePowerScore, computeStatsFromEquipment,
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
