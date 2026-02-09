import { EQUIPMENT_TYPES, MAX_LEVEL, SAVE_KEY, BONUS_STAT_KEYS, HEALTH_ITEMS, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL } from './config.js';
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
    // Bonus fields are optional (backward compat with old saves)
    if (item.bonusType !== undefined) {
        if (!BONUS_STAT_KEYS.includes(item.bonusType)) return false;
        if (typeof item.bonusValue !== 'number' || item.bonusValue < 0) return false;
    }
    return true;
}

const gameState = {
    equipment: createEmptyEquipment(),
    forgedItem: null,
    gold: 0,
};

export function resetGame() {
    gameState.equipment = createEmptyEquipment();
    gameState.forgedItem = null;
    gameState.gold = 0;
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

export function equipItem(item) {
    const oldItem = gameState.equipment[item.type];
    if (oldItem) {
        const goldEarned = oldItem.level;
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

    const goldEarned = item.level;
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
                const item = { ...equipmentData[type] };
                const isHealthItem = HEALTH_ITEMS.includes(item.type);
                item.stats = isHealthItem ? item.level * HEALTH_PER_LEVEL : item.level * DAMAGE_PER_LEVEL;
                gameState.equipment[type] = item;
            }
        });

        if (typeof loaded.gold === 'number' && loaded.gold >= 0) {
            gameState.gold = Math.floor(loaded.gold);
        }

        gameEvents.emit(EVENTS.GAME_LOADED);
        gameEvents.emit(EVENTS.STATE_CHANGED);
    } catch (error) {
        console.error('Error loading save:', error);
    }
}
