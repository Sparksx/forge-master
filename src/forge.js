import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL,
    LEVEL_RANGE, MAX_LEVEL, INITIAL_LEVEL_MAX, BONUS_STATS, BONUS_STAT_KEYS,
    GROWTH_EXPONENT, TIERS, FORGE_LEVELS
} from './config.js';
import { calculateItemStats, calculateStats, calculatePowerScore } from '../shared/stats.js';
import { getEquipmentByType, getHighestLevelForSlot, trackForgedLevel, setForgedItem, getForgeLevel, getTechEffect } from './state.js';
import { gameEvents, EVENTS } from './events.js';

// Re-export shared functions so existing imports keep working
export { calculateItemStats, calculateStats, calculatePowerScore };

function rollBonuses(count) {
    // Extra Bonus tech: +1 bonus slot per level
    const extraBonusSlots = getTechEffect('extraBonus');
    const totalCount = Math.min(count + extraBonusSlots, BONUS_STAT_KEYS.length);

    // Bonus Enhancement tech: +10% bonus values per level
    const bonusEnhancePct = getTechEffect('bonusEnhance');

    const bonuses = [];
    const usedKeys = new Set();
    for (let i = 0; i < totalCount; i++) {
        let key;
        do {
            key = BONUS_STAT_KEYS[Math.floor(Math.random() * BONUS_STAT_KEYS.length)];
        } while (usedKeys.has(key));
        usedKeys.add(key);
        let value = Math.floor(Math.random() * BONUS_STATS[key].max) + 1;
        if (bonusEnhancePct > 0) {
            value = Math.floor(value * (1 + bonusEnhancePct / 100));
        }
        bonuses.push({ type: key, value });
    }
    return bonuses;
}

export function createItem(type, level, tier = 1) {
    const isHealthItem = HEALTH_ITEMS.includes(type);
    const stats = calculateItemStats(level, tier, isHealthItem);
    const tierDef = TIERS[tier - 1];
    const bonuses = rollBonuses(tierDef.bonusCount);

    return {
        type,
        level,
        tier,
        stats,
        statType: isHealthItem ? 'health' : 'damage',
        bonuses,
    };
}

export function rollTier(forgeLevel) {
    const forgeDef = FORGE_LEVELS[forgeLevel - 1];
    const tierAffinityBonus = getTechEffect('tierAffinity'); // +3% per level shift to higher tiers
    const chances = [...forgeDef.chances];

    // Tier Affinity: shift chance from lowest tier to next tiers
    if (tierAffinityBonus > 0) {
        let remainingShift = tierAffinityBonus;
        for (let i = 0; i < chances.length - 1 && remainingShift > 0; i++) {
            const shift = Math.min(chances[i], remainingShift);
            chances[i] -= shift;
            chances[i + 1] += shift;
            remainingShift -= shift;
        }
    }

    const roll = Math.random() * 100;
    let cumulative = 0;
    for (let i = 0; i < chances.length; i++) {
        cumulative += chances[i];
        if (roll < cumulative) return i + 1;
    }
    return 1;
}

// Map each equipment slot to its mastery tech effect type
const SLOT_MASTERY_MAP = {
    hat: 'hatMastery',
    armor: 'armorMastery',
    belt: 'beltMastery',
    boots: 'bootsMastery',
    gloves: 'glovesMastery',
    necklace: 'necklaceMastery',
    ring: 'ringMastery',
    weapon: 'weaponMastery',
};

/** Get effective max level for a given equipment type, considering tech bonuses */
export function getEffectiveMaxLevel(type) {
    const masteryEffect = SLOT_MASTERY_MAP[type];
    const bonus = masteryEffect ? getTechEffect(masteryEffect) : 0;
    return MAX_LEVEL + bonus;
}

export function forgeEquipment() {
    const randomType = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];
    const tier = rollTier(getForgeLevel());

    const effectiveMaxLevel = getEffectiveMaxLevel(randomType);
    const highestForSlot = getHighestLevelForSlot(randomType, tier);

    let randomLevel;
    if (highestForSlot !== null) {
        const minLevel = Math.max(1, highestForSlot - LEVEL_RANGE);
        const maxLevel = Math.min(effectiveMaxLevel, highestForSlot + LEVEL_RANGE);
        randomLevel = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
    } else {
        randomLevel = Math.floor(Math.random() * INITIAL_LEVEL_MAX) + 1;
    }

    // Masterwork: 10% chance for +20 levels
    const hasMasterwork = getTechEffect('masterwork') > 0;
    if (hasMasterwork && Math.random() < 0.10) {
        randomLevel = Math.min(effectiveMaxLevel, randomLevel + 20);
    }

    const item = createItem(randomType, randomLevel, tier);
    trackForgedLevel(randomType, tier, randomLevel);
    setForgedItem(item);
    gameEvents.emit(EVENTS.ITEM_FORGED, item);

    return item;
}

// calculatePowerScore is now in shared/stats.js and re-exported above
