// Forge logic — roll a random item. Stat math comes from shared/stats.js.
import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, TIERS, BONUS_STATS, BONUS_STAT_KEYS,
    calculateItemStats, FORGE_LEVELS, forgeXpForRarity,
    FORGE_GOLD_CHANCE, forgeGoldDrop,
    INITIAL_LEVEL_MAX, LEVEL_BAND, MAX_ITEM_LEVEL,
} from './config.js';
import { itemName } from './items.js';
import { getForgeLevel, getBestLevelForSlot, recordForgedLevel, getForgeLuckPct, grantForgeXp } from './state.js';

// Minimum bonus value (as % of max) by tier: Legendary+ guarantees strong rolls.
const BONUS_MIN_PCT = [0, 0, 0, 0, 15, 30, 50];

export function rollBonuses(count, tier) {
    const minPct = BONUS_MIN_PCT[tier - 1] || 0;
    const bonuses = [];
    const used = new Set();
    for (let i = 0; i < count && used.size < BONUS_STAT_KEYS.length; i++) {
        let key;
        do {
            key = BONUS_STAT_KEYS[Math.floor(Math.random() * BONUS_STAT_KEYS.length)];
        } while (used.has(key));
        used.add(key);
        const max = BONUS_STATS[key].max;
        const min = minPct > 0 ? Math.max(1, Math.ceil((max * minPct) / 100)) : 1;
        bonuses.push({ type: key, value: Math.floor(Math.random() * (max - min + 1)) + min });
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
        return Math.floor(Math.random() * INITIAL_LEVEL_MAX) + 1;
    }
    const min = Math.max(1, best - LEVEL_BAND);
    const max = Math.min(MAX_ITEM_LEVEL, best + LEVEL_BAND);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Forge one item using current game state (forge level, clan luck, best-level
 * memory). Returns `{ item, gold }`: the gear that was forged plus a gold nugget
 * amount (0 most of the time — the forge only occasionally yields gold, since
 * gold is otherwise scarce).
 */
export function forge() {
    const forgeLevel = getForgeLevel();
    const type = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];
    const tier = rollTier(forgeLevel, getForgeLuckPct());
    const level = rollLevel(getBestLevelForSlot(type, tier));
    const item = createItem(type, level, tier);
    recordForgedLevel(type, tier, level);
    grantForgeXp(forgeXpForRarity(tier)); // rarer rolls advance the forge faster
    const gold = Math.random() < FORGE_GOLD_CHANCE ? forgeGoldDrop(forgeLevel, tier) : 0;
    return { item, gold };
}
