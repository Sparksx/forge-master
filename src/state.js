import { EQUIPMENT_TYPES, MAX_LEVEL, SAVE_KEY } from './config.js';
import { gameEvents, EVENTS } from './events.js';

function createEmptyEquipment() {
    const equipment = {};
    EQUIPMENT_TYPES.forEach(type => { equipment[type] = null; });
    return equipment;
}

function isValidItem(item) {
    return item
        && typeof item === 'object'
        && typeof item.type === 'string'
        && EQUIPMENT_TYPES.includes(item.type)
        && typeof item.level === 'number'
        && Number.isInteger(item.level)
        && item.level >= 1
        && item.level <= MAX_LEVEL
        && typeof item.stats === 'number'
        && typeof item.statType === 'string'
        && (item.statType === 'health' || item.statType === 'damage');
}

const gameState = {
    equipment: createEmptyEquipment(),
    forgedItem: null,
    gold: 0,
};

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
                gameState.equipment[type] = equipmentData[type];
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
