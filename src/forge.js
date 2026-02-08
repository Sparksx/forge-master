import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL,
    LEVEL_RANGE, MAX_LEVEL, INITIAL_LEVEL_MAX, BONUS_STATS, BONUS_STAT_KEYS
} from './config.js';
import { getEquipmentByType, setForgedItem } from './state.js';
import { gameEvents, EVENTS } from './events.js';

function rollBonus() {
    const key = BONUS_STAT_KEYS[Math.floor(Math.random() * BONUS_STAT_KEYS.length)];
    const value = Math.floor(Math.random() * BONUS_STATS[key].max) + 1;
    return { bonusType: key, bonusValue: value };
}

export function createItem(type, level) {
    const isHealthItem = HEALTH_ITEMS.includes(type);
    const stats = isHealthItem ? level * HEALTH_PER_LEVEL : level * DAMAGE_PER_LEVEL;
    const bonus = rollBonus();

    return {
        type,
        level,
        stats,
        statType: isHealthItem ? 'health' : 'damage',
        bonusType: bonus.bonusType,
        bonusValue: bonus.bonusValue,
    };
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

    const item = createItem(randomType, randomLevel);
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
        if (item.bonusType && item.bonusValue) {
            bonuses[item.bonusType] = (bonuses[item.bonusType] || 0) + item.bonusValue;
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
