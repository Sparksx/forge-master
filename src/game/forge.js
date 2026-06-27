// Forge logic — roll a random item. Stat math comes from shared/stats.js.
import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, TIERS, BONUS_STATS, BONUS_STAT_KEYS,
    calculateItemStats, FORGE_LEVELS, forgeXpForRarity,
    FORGE_GOLD_CHANCE, forgeGoldDrop,
    INITIAL_LEVEL_MAX, LEVEL_BAND, MAX_ITEM_LEVEL,
} from './config.js';
import { itemName } from './items.js';
import { getForgeLevel, getBestLevelForSlot, recordForgedLevel, getForgeLuckPct, grantForgeXp } from './state.js';
import { randomItem, randomInt } from '../../shared/utils.js';

// Minimum bonus value (as % of max) by tier: Legendary+ guarantees strong rolls.
const BONUS_MIN_PCT = [0, 0, 0, 0, 15, 30, 50];

export function rollBonuses(count, tier) {
    const minPct = BONUS_MIN_PCT[tier - 1] || 0;
    const bonuses = [];
    const used = new Set();
    for (let i = 0; i < count && used.size < BONUS_STAT_KEYS.length; i++) {
        let key;
        do {
            key = randomItem(BONUS_STAT_KEYS);
        } while (used.has(key));
        used.add(key);
        const max = BONUS_STATS[key].max;
        const min = minPct > 0 ? Math.max(1, Math.ceil((max * minPct) / 100)) : 1;
        bonuses.push({ type: key, value: randomInt(min, max) });
    }
    return bonuses;
}

export function createItem(type, level, tier = 1, attackStyle = null) {
    const isHealth = HEALTH_ITEMS.includes(type);
    const stats = calculateItemStats(level, tier, isHealth);
    const item = {
        type,
        level,
        tier,
        stats,
        statType: isHealth ? 'health' : 'damage',
        bonuses: rollBonuses(TIERS[tier - 1].bonusCount, tier),
    };
    // Weapons are melee or ranged; ranged ones open fights sooner in combat.
    if (type === 'weapon') {
        item.attackStyle = attackStyle || (Math.random() < 0.5 ? 'ranged' : 'melee');
    }
    item.name = itemName(item);
    return item;
}

/**
 * Roll a tier from a forge level's odds. `luckPct` shifts weight from the lowest
 * remaining tier upward (clan perk), making higher rarities more likely.
 */
export function rollTier(forgeLevel, luckPct = 0) {
    const base = FORGE_LEVELS[Math.min(forgeLevel, FORGE_LEVELS.length) - 1].chances;
    const chances = [...base];
    let shift = luckPct;
    for (let i = 0; i < chances.length - 1 && shift > 0; i++) {
        const moved = Math.min(chances[i], shift);
        chances[i] -= moved;
        chances[i + 1] += moved;
        shift -= moved;
    }
    const roll = Math.random() * 100;
    let cumulative = 0;
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i];
        if (roll < cumulative) return i + 1;
    }
    return 1;
}

/** Pick the level for a freshly rolled item, banded around your best for that slot. */
export function rollLevel(best) {
    if (best == null) {
        return randomInt(1, INITIAL_LEVEL_MAX);
    }
    const min = Math.max(1, best - LEVEL_BAND);
    const max = Math.min(MAX_ITEM_LEVEL, best + LEVEL_BAND);
    return randomInt(min, max);
}

/** Sum of an item's bonus values — a tie-breaker when ranking forge candidates. */
function bonusSum(item) {
    return (item.bonuses || []).reduce((s, b) => s + (b.value || 0), 0);
}

/** True if candidate `a` is a better forge result than `b` (rarity → level → bonuses). */
function isBetterForge(a, b) {
    if (a.tier !== b.tier) return a.tier > b.tier;
    if (a.level !== b.level) return a.level > b.level;
    return bonusSum(a) > bonusSum(b);
}

/**
 * Forge using current game state (forge level, clan luck, best-level memory).
 *
 * `count` is the clan "best-of-N" perk: roll N candidates and keep the single best
 * (by rarity, then level, then bonuses). Returns `{ item, gold, rolls }`: the kept
 * gear, the summed gold nuggets across all rolls (0 most of the time — gold is
 * scarce), and how many candidates were rolled. Forge XP is granted once for the
 * kept item so best-of-N stays a "pick the best" perk, not an XP multiplier.
 */
export function forge(count = 1) {
    const rolls = Math.max(1, Math.floor(count));
    const forgeLevel = getForgeLevel();
    let best = null;
    let gold = 0;
    for (let i = 0; i < rolls; i++) {
        const type = randomItem(EQUIPMENT_TYPES);
        const tier = rollTier(forgeLevel, getForgeLuckPct());
        const level = rollLevel(getBestLevelForSlot(type, tier));
        const item = createItem(type, level, tier);
        if (Math.random() < FORGE_GOLD_CHANCE) gold += forgeGoldDrop(forgeLevel, tier);
        if (!best || isBetterForge(item, best)) best = item;
    }
    recordForgedLevel(best.type, best.tier, best.level);
    grantForgeXp(forgeXpForRarity(best.tier)); // rarer rolls advance the forge faster
    return { item: best, gold, rolls };
}
