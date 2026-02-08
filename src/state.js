import { EQUIPMENT_TYPES, SAVE_KEY } from './config.js';
import { gameEvents, EVENTS } from './events.js';

function createEmptyEquipment() {
    const equipment = {};
    EQUIPMENT_TYPES.forEach(type => { equipment[type] = null; });
    return equipment;
}

const gameState = {
    equipment: createEmptyEquipment(),
    forgedItem: null,
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

export function equipItem(item) {
    gameState.equipment[item.type] = item;
    gameState.forgedItem = null;
    saveGame();
    gameEvents.emit(EVENTS.ITEM_EQUIPPED, item);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function discardForgedItem() {
    const item = gameState.forgedItem;
    gameState.forgedItem = null;
    gameEvents.emit(EVENTS.ITEM_SOLD, item);
}

export function saveGame() {
    try {
        const saveData = JSON.stringify(gameState.equipment);
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

        EQUIPMENT_TYPES.forEach(type => {
            if (loaded[type] && typeof loaded[type] === 'object') {
                gameState.equipment[type] = loaded[type];
            }
        });

        gameEvents.emit(EVENTS.GAME_LOADED);
        gameEvents.emit(EVENTS.STATE_CHANGED);
    } catch (error) {
        console.error('Error loading save:', error);
    }
}
