import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL,
    LEVEL_RANGE, MAX_LEVEL, INITIAL_LEVEL_MAX
} from './config.js';
import { getEquipmentByType, setForgedItem } from './state.js';
import { gameEvents, EVENTS } from './events.js';

export function createItem(type, level) {
    const isHealthItem = HEALTH_ITEMS.includes(type);
    const stats = isHealthItem ? level * HEALTH_PER_LEVEL : level * DAMAGE_PER_LEVEL;

    return {
        type,
        level,
        stats,
        statType: isHealthItem ? 'health' : 'damage',
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

    Object.values(equipment).forEach(item => {
        if (!item) return;
        if (item.statType === 'health') {
            totalHealth += item.stats;
        } else {
            totalDamage += item.stats;
        }
    });

    return { totalHealth, totalDamage };
}
