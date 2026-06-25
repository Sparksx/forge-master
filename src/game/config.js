// Game constants for Gear Master: Reforged.
// Item stat math + tiers live in shared/stats.js (single source of truth, shared
// with the server). This file holds the client-side game-design knobs.

// MAX_FORGE_LEVEL is imported (not derived) so the client and the server's save
// validator share one source of truth; FORGE_LEVELS must match it (asserted in tests).
import { MAX_FORGE_LEVEL, MAX_ITEM_LEVEL } from '../../shared/stats.js';
import { PREMIUM_AVATARS } from '../../shared/cosmetics.js';

export { MAX_FORGE_LEVEL, MAX_ITEM_LEVEL };
export {
    EQUIPMENT_TYPES, HEALTH_ITEMS, DAMAGE_ITEMS,
    TIERS, MAX_TIER, BONUS_STATS, BONUS_STAT_KEYS,
    MAX_PLAYER_LEVEL, playerBaseHealth, playerBaseDamage, playerPowerScore,
    calculateItemStats, calculateStats, calculatePowerScore, computeStatsFromEquipment,
    BASE_ATTACK_PERIOD, MAX_BATTLE_SECONDS, ATTACK_STYLES, RANGED_OPENING_FRACTION,
    weaponStyle,
} from '../../shared/stats.js';

export const SAVE_KEY = 'fm_reforged_save';

// Emoji per slot (visual fallback; sprite art can override later).
export const SLOT_ICONS = {
    weapon: '⚔️', armor: '🛡️', hat: '🪖', gloves: '🧤',
    boots: '🥾', belt: '🎗️', necklace: '📿', ring: '💍',
};

export const SLOT_LABELS = {
    weapon: 'Weapon', armor: 'Armor', hat: 'Helm', gloves: 'Gloves',
    boots: 'Boots', belt: 'Belt', necklace: 'Amulet', ring: 'Ring',
};

// Forge: 35 levels of rarity odds. NO real-time timers. Levels come mainly from
// forge XP (earned by forging — see the XP curve below); the gold `cost` is only
// an optional instant shortcut. chances = [Common, Uncommon, Rare, Epic,
// Legendary, Mythic, Divine] (each row sums to 100).
//
// These rows are GENERATED from a single math model, not hand-tuned — see
// docs/forge-balance.md for the full reasoning and the generator. In short: a
// Gaussian "traveling bump" over the 7 rarities slides upward as the forge
// levels, capped to at most 4 active rarities at any level. Consequences (all
// intentional, do not "fix" them piecemeal — re-run the generator instead):
//   • L1 is 100% Common; each new rarity enters low and late (Rare not until L8,
//     Divine not until L32) so you out-gear your set before the next tier matters.
//   • At most 4 rarities are ever rollable at once; the lowest decays to exactly 0
//     (Common gone by L23, Uncommon by L27, Rare by L32).
//   • At max level Divine sits at 20% — pinned on the bump's rising edge as the
//     permanent jackpot, never the mode.
// The gold `cost` curve is the cheap "fast lane" (10 → ~122k) deliberately left
// far below the forge-XP grind, intended as a shop-gold sink (see REDESIGN.md).
export const FORGE_LEVELS = [
    { cost:      0, chances: [100,  0,  0,  0,  0,  0,  0] },
    { cost:     10, chances: [ 92,  8,  0,  0,  0,  0,  0] },
    { cost:     15, chances: [ 91,  9,  0,  0,  0,  0,  0] },
    { cost:     20, chances: [ 90, 10,  0,  0,  0,  0,  0] },
    { cost:     25, chances: [ 88, 12,  0,  0,  0,  0,  0] },
    { cost:     30, chances: [ 87, 13,  0,  0,  0,  0,  0] },
    { cost:     40, chances: [ 84, 16,  0,  0,  0,  0,  0] },
    { cost:     55, chances: [ 81, 18,  1,  0,  0,  0,  0] },
    { cost:     75, chances: [ 77, 22,  1,  0,  0,  0,  0] },
    { cost:    100, chances: [ 73, 25,  2,  0,  0,  0,  0] },
    { cost:    130, chances: [ 68, 30,  2,  0,  0,  0,  0] },
    { cost:    175, chances: [ 61, 35,  4,  0,  0,  0,  0] },
    { cost:    230, chances: [ 55, 40,  5,  0,  0,  0,  0] },
    { cost:    305, chances: [ 47, 45,  8,  0,  0,  0,  0] },
    { cost:    405, chances: [ 39, 49, 12,  0,  0,  0,  0] },
    { cost:    540, chances: [ 31, 52, 16,  1,  0,  0,  0] },
    { cost:    720, chances: [ 24, 52, 22,  2,  0,  0,  0] },
    { cost:    960, chances: [ 17, 51, 29,  3,  0,  0,  0] },
    { cost:   1275, chances: [ 11, 47, 36,  6,  0,  0,  0] },
    { cost:   1695, chances: [  7, 40, 44,  9,  0,  0,  0] },
    { cost:   2255, chances: [  4, 33, 49, 14,  0,  0,  0] },
    { cost:   3000, chances: [  2, 25, 52, 21,  0,  0,  0] },
    { cost:   3990, chances: [  0, 18, 51, 28,  3,  0,  0] },
    { cost:   5305, chances: [  0, 11, 46, 37,  6,  0,  0] },
    { cost:   7055, chances: [  0,  7, 39, 44, 10,  0,  0] },
    { cost:   9385, chances: [  0,  4, 31, 50, 15,  0,  0] },
    { cost:  12480, chances: [  0,  0, 23, 52, 23,  2,  0] },
    { cost:  16600, chances: [  0,  0, 15, 49, 32,  4,  0] },
    { cost:  22080, chances: [  0,  0,  9, 43, 41,  7,  0] },
    { cost:  29365, chances: [  0,  0,  5, 34, 48, 13,  0] },
    { cost:  39055, chances: [  0,  0,  3, 25, 52, 20,  0] },
    { cost:  51945, chances: [  0,  0,  0, 17, 50, 30,  3] },
    { cost:  69090, chances: [  0,  0,  0, 10, 45, 39,  6] },
    { cost:  91885, chances: [  0,  0,  0,  5, 36, 47, 12] },
    { cost: 122210, chances: [  0,  0,  0,  2, 26, 52, 20] },
];

// ── Forge XP ────────────────────────────────────────────────────────────────
// Each forge grants XP toward the next forge level, so forging more makes the
// forge stronger on its own. XP is rarity-weighted: a Common roll grants 1, a
// Divine grants 7 — rarer rolls advance the forge faster. The gold-cost upgrades
// in FORGE_LEVELS still work as an optional way to buy the next level instantly.
//
// The pacing is expressed as an EXPECTED-FORGES curve (FORGE_BASE_FORGES growing
// geometrically by FORGE_FORGE_GROWTH per level). The XP threshold for a level is
// that expected-forge count times the average rarity XP a forge grants at that
// level, so on average it really does take ~that many forges — rarity weighting
// only adds upside variance, not faster overall leveling. Tuned so L1→L2 ≈ 100
// forges and reaching the cap (level 35) costs ~1.04M forges in total — a true
// long-haul, sized for the future "multiple gear per forge" upgrades that will
// accelerate the rate. See docs/forge-balance.md for the derivation.
export const FORGE_BASE_FORGES = 100;    // expected forges for L1 → L2
export const FORGE_FORGE_GROWTH = 1.262; // per-level geometric growth of that count

/** Forge XP granted for forging an item of the given rarity tier (Common=1 … Divine=7). */
export function forgeXpForRarity(tier) {
    return Math.max(1, Math.floor(tier));
}

/** Average forge XP per forge at a given forge level, from its rarity odds. */
function avgForgeXp(level) {
    const chances = FORGE_LEVELS[Math.min(level, MAX_FORGE_LEVEL) - 1].chances;
    return chances.reduce((sum, c, i) => sum + c * forgeXpForRarity(i + 1), 0) / 100;
}

/** Expected number of forges to advance FROM `level` to level+1 (geometric curve). */
export function forgesForLevel(level) {
    return Math.round(FORGE_BASE_FORGES * Math.pow(FORGE_FORGE_GROWTH, level - 1));
}

/** XP needed to advance the forge FROM `level` to level+1 (null once maxed). */
export function forgeXpForLevel(level) {
    if (level >= MAX_FORGE_LEVEL) return null;
    // Threshold = expected forges at this level × average rarity XP per forge, so
    // the expected number of forges per level matches the forgesForLevel() curve;
    // rarity weighting then adds upside variance, not faster overall leveling.
    return Math.max(1, Math.round(forgesForLevel(level) * avgForgeXp(level)));
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

// ── Gold economy: gold is deliberately scarce ────────────────────────────────
// Gold is a trickle, not a faucet. Every in-game payout is a *tiny* gift: in the
// arena only bosses pay out (a handful of gold — see `encounterReward` in
// arena.js), normal packs drop nothing, and gear can't be sold back for gold
// (forged items are equipped or trashed). The forge has a small chance to spit
// out a small gold nugget alongside the gear. Accumulating gold in any real
// quantity is meant to happen through the (future) gold shop, not by grinding.
export const STARTING_GOLD = 100;      // fresh players begin with a small purse
export const FORGE_GOLD_CHANCE = 0.08; // chance a single forge also drops gold

/**
 * Gold yielded by a lucky forge — a tiny gift that scales gently with forge
 * progress and the rarity rolled, but never more than a few coins.
 */
export function forgeGoldDrop(forgeLevel, tier) {
    return 1 + Math.floor(forgeLevel / 2) + Math.max(0, tier - 4);
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

/**
 * Rank to retry after a loss: drop one sub-stage, but never below the current
 * chapter's first sub-stage (you can lose ground inside a chapter, never fall
 * back a chapter). e.g. 3-5 → 3-4, 3-1 → 3-1.
 */
export function arenaFallbackRank(rank) {
    const sub = ((rank - 1) % STAGES_PER_CHAPTER) + 1;
    const chapterFloor = rank - (sub - 1);
    return Math.max(1, chapterFloor, rank - 1);
}

// Cost to found a clan (deducted from gold, client-side). A genuine long-haul
// goal given how slowly gold trickles in — reachable by dedicated players over
// time, or sooner by buying gold in the shop.
export const CLAN_CREATE_COST = 500;

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
    const free = AVATARS.find((a) => a.id === id);
    if (free) return free.emoji;
    const premium = PREMIUM_AVATARS.find((a) => a.id === id);
    if (premium) return premium.emoji;
    return AVATARS[0].emoji;
}
