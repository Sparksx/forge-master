export class EventEmitter {
    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error(`EventEmitter: listener for "${event}" threw:`, err);
            }
        });
    }
}

export const gameEvents = new EventEmitter();

// Event names
export const EVENTS = {
    STATE_CHANGED: 'state:changed',
    ITEM_FORGED: 'item:forged',
    ITEM_EQUIPPED: 'item:equipped',
    ITEM_TRASHED: 'item:trashed',
    GOLD_PURCHASED: 'gold:purchased',
    GAME_LOADED: 'game:loaded',
    FORGE_UPGRADED: 'forge:upgraded',
    COMBAT_MONSTER_DEFEATED: 'combat:monster_defeated',
    PLAYER_LEVEL_UP: 'player:level_up',
    // Locale
    LOCALE_CHANGED: 'locale:changed',
    // Reforged
    CLAN_CHANGED: 'clan:changed',
    ARENA_RESULT: 'arena:result',
    CHAT_UPDATED: 'chat:updated',
    CHAT_CONVERSATION_OPENED: 'chat:conversation_opened',
    CHAT_ERROR: 'chat:error',
};
