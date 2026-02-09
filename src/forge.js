import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL,
    LEVEL_RANGE, MAX_LEVEL, INITIAL_LEVEL_MAX, BONUS_STATS, BONUS_STAT_KEYS,
    GROWTH_EXPONENT, TIERS, FORGE_LEVELS
} from './config.js';
import { getEquipmentByType, setForgedItem, getForgeLevel } from './state.js';
import { gameEvents, EVENTS } from './events.js';

function rollBonuses(count) {
    const bonuses = [];
    const usedKeys = new Set();
    for (let i = 0; i < count; i++) {
        let key;
        do {
            key = BONUS_STAT_KEYS[Math.floor(Math.random() * BONUS_STAT_KEYS.length)];
        } while (usedKeys.has(key));
        usedKeys.add(key);
        const value = Math.floor(Math.random() * BONUS_STATS[key].max) + 1;
        bonuses.push({ type: key, value });
    }
    return bonuses;
}

export function calculateItemStats(level, tier, isHealthItem) {
    const effectiveLevel = (tier - 1) * 100 + level;
    const perLevel = isHealthItem ? HEALTH_PER_LEVEL : DAMAGE_PER_LEVEL;
    return Math.floor(perLevel * Math.pow(effectiveLevel, GROWTH_EXPONENT));
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
    const roll = Math.random() * 100;
    let cumulative = 0;
    for (let i = 0; i < forgeDef.chances.length; i++) {
        cumulative += forgeDef.chances[i];
        if (roll < cumulative) return i + 1;
    }
    return 1;
}

export function forgeEquipment() {
    const randomType = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];
    const currentItem = getEquipmentByType(randomType);

    let randomLevel;
    if (currentItem) {
        const minLevel = Math.max(1, currentItem.level - LEVEL_RANGE);
        const maxLevel = Math.min(MAX_LEVEL, currentItem.level + LEVEL_RANGE);
        randomLevel = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
    } else {
        randomLevel = Math.floor(Math.random() * INITIAL_LEVEL_MAX) + 1;
    }

    const tier = rollTier(getForgeLevel());
    const item = createItem(randomType, randomLevel, tier);
    setForgedItem(item);
    gameEvents.emit(EVENTS.ITEM_FORGED, item);

    return item;
}

export function calculateStats(equipment) {
    let totalHealth = 0;
    let totalDamage = 0;
    const bonuses = {};

    BONUS_STAT_KEYS.forEach(key => { bonuses[key] = 0; });

    Object.values(equipment).forEach(item => {
        if (!item) return;
        if (item.statType === 'health') {
            totalHealth += item.stats;
        } else {
            totalDamage += item.stats;
        }
        if (item.bonuses && Array.isArray(item.bonuses)) {
            item.bonuses.forEach(bonus => {
                if (bonus.type && bonus.value) {
                    bonuses[bonus.type] = (bonuses[bonus.type] || 0) + bonus.value;
                }
            });
        }
    });

    return { totalHealth, totalDamage, bonuses };
}

export function calculatePowerScore(totalHealth, totalDamage, bonuses) {
    const b = bonuses || {};
    const effectiveHealth = totalHealth
        * (1 + (b.healthMulti || 0) / 100)
        * (1 + ((b.healthRegen || 0) + (b.lifeSteal || 0)) / 100);
    const effectiveDamage = totalDamage
        * (1 + (b.damageMulti || 0) / 100)
        * (1 + (b.attackSpeed || 0) / 100)
        * (1 + (b.critChance || 0) / 100 * (b.critMultiplier || 0) / 100);
    return Math.round(effectiveHealth + effectiveDamage);
}
