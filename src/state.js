import {
    EQUIPMENT_TYPES, MAX_LEVEL, SAVE_KEY, BONUS_STAT_KEYS, HEALTH_ITEMS,
    HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, TIERS, FORGE_LEVELS, MAX_FORGE_LEVEL, GROWTH_EXPONENT
} from './config.js';
import { gameEvents, EVENTS } from './events.js';

function createEmptyEquipment() {
    const equipment = {};
    EQUIPMENT_TYPES.forEach(type => { equipment[type] = null; });
    return equipment;
}

function isValidItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.type !== 'string' || !EQUIPMENT_TYPES.includes(item.type)) return false;
    if (typeof item.level !== 'number' || !Number.isInteger(item.level)) return false;
    if (item.level < 1 || item.level > MAX_LEVEL) return false;
    if (typeof item.stats !== 'number') return false;
    if (typeof item.statType !== 'string') return false;
    if (item.statType !== 'health' && item.statType !== 'damage') return false;
    if (item.tier !== undefined) {
        if (typeof item.tier !== 'number' || item.tier < 1 || item.tier > TIERS.length) return false;
    }
    if (item.bonuses !== undefined) {
        if (!Array.isArray(item.bonuses)) return false;
        for (const bonus of item.bonuses) {
            if (!bonus || typeof bonus !== 'object') return false;
            if (!BONUS_STAT_KEYS.includes(bonus.type)) return false;
            if (typeof bonus.value !== 'number' || bonus.value < 0) return false;
        }
    }
    // Backward compat: old format with bonusType/bonusValue
    if (item.bonusType !== undefined && !item.bonuses) {
        if (!BONUS_STAT_KEYS.includes(item.bonusType)) return false;
        if (typeof item.bonusValue !== 'number' || item.bonusValue < 0) return false;
    }
    return true;
}

function migrateItem(item) {
    const migrated = { ...item };
    // Migrate old bonusType/bonusValue to bonuses array
    if (!migrated.bonuses) {
        if (migrated.bonusType && migrated.bonusValue) {
            migrated.bonuses = [{ type: migrated.bonusType, value: migrated.bonusValue }];
            migrated.tier = 2; // old items had 1 bonus → tier 2
        } else {
            migrated.bonuses = [];
            migrated.tier = 1;
        }
        delete migrated.bonusType;
        delete migrated.bonusValue;
    }
    if (!migrated.tier) {
        migrated.tier = 1;
    }
    return migrated;
}

function recalculateStats(item) {
    const isHealthItem = HEALTH_ITEMS.includes(item.type);
    const effectiveLevel = (item.tier - 1) * 100 + item.level;
    const perLevel = isHealthItem ? HEALTH_PER_LEVEL : DAMAGE_PER_LEVEL;
    item.stats = Math.floor(perLevel * Math.pow(effectiveLevel, GROWTH_EXPONENT));
    return item;
}

const gameState = {
    equipment: createEmptyEquipment(),
    forgedItem: null,
    gold: 0,
    forgeLevel: 1,
};

export function resetGame() {
    gameState.equipment = createEmptyEquipment();
    gameState.forgedItem = null;
    gameState.gold = 0;
    gameState.forgeLevel = 1;
}

export function getEquipment() {
    return gameState.equipment;
}

export function getEquipmentByType(type) {
    return gameState.equipment[type];
}

export function getForgedItem() {
    return gameState.forgedItem;
}

export function setForgedItem(item) {
    gameState.forgedItem = item;
}

export function getGold() {
    return gameState.gold;
}

export function addGold(amount) {
    gameState.gold += amount;
    saveGame();
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function getForgeLevel() {
    return gameState.forgeLevel;
}

export function getSellValue(item) {
    return item.level * (item.tier || 1);
}

export function getForgeUpgradeCost() {
    if (gameState.forgeLevel >= MAX_FORGE_LEVEL) return null;
    return FORGE_LEVELS[gameState.forgeLevel].cost;
}

export function upgradeForge() {
    const cost = getForgeUpgradeCost();
    if (cost === null) return false;
    if (gameState.gold < cost) return false;
    gameState.gold -= cost;
    gameState.forgeLevel += 1;
    saveGame();
    gameEvents.emit(EVENTS.FORGE_UPGRADED, gameState.forgeLevel);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

export function equipItem(item) {
    const oldItem = gameState.equipment[item.type];
    if (oldItem) {
        const goldEarned = getSellValue(oldItem);
        gameState.gold += goldEarned;
        gameEvents.emit(EVENTS.ITEM_SOLD, { item: oldItem, goldEarned });
    }
    gameState.equipment[item.type] = item;
    gameState.forgedItem = null;
    saveGame();
    gameEvents.emit(EVENTS.ITEM_EQUIPPED, item);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function sellForgedItem() {
    const item = gameState.forgedItem;
    if (!item) return 0;

    const goldEarned = getSellValue(item);
    gameState.gold += goldEarned;
    gameState.forgedItem = null;
    saveGame();
    gameEvents.emit(EVENTS.ITEM_SOLD, { item, goldEarned });
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return goldEarned;
}

export function saveGame() {
    try {
        const saveData = JSON.stringify({
            equipment: gameState.equipment,
            gold: gameState.gold,
            forgeLevel: gameState.forgeLevel,
        });
        localStorage.setItem(SAVE_KEY, saveData);
    } catch (error) {
        console.error('Error saving game:', error);
    }
}

export function loadGame() {
    try {
        const savedData = localStorage.getItem(SAVE_KEY);
        if (!savedData) return;

        const loaded = JSON.parse(savedData);
        if (typeof loaded !== 'object' || loaded === null) return;

        // Support both old format (flat equipment) and new format ({equipment, gold})
        const equipmentData = loaded.equipment || loaded;

        EQUIPMENT_TYPES.forEach(type => {
            if (isValidItem(equipmentData[type])) {
                let item = migrateItem(equipmentData[type]);
                item = recalculateStats(item);
                gameState.equipment[type] = item;
            }
        });

        if (typeof loaded.gold === 'number' && loaded.gold >= 0) {
            gameState.gold = Math.floor(loaded.gold);
        }

        if (typeof loaded.forgeLevel === 'number' && loaded.forgeLevel >= 1 && loaded.forgeLevel <= MAX_FORGE_LEVEL) {
            gameState.forgeLevel = Math.floor(loaded.forgeLevel);
        }

        gameEvents.emit(EVENTS.GAME_LOADED);
        gameEvents.emit(EVENTS.STATE_CHANGED);
    } catch (error) {
        console.error('Error loading save:', error);
    }
}
