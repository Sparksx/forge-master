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
        this.listeners[event].forEach(callback => callback(data));
    }
}

export const gameEvents = new EventEmitter();

// Event names
export const EVENTS = {
    STATE_CHANGED: 'state:changed',
    ITEM_FORGED: 'item:forged',
    ITEM_EQUIPPED: 'item:equipped',
    ITEM_SOLD: 'item:sold',
    GOLD_PURCHASED: 'gold:purchased',
    GAME_LOADED: 'game:loaded',
    FORGE_UPGRADED: 'forge:upgraded',
};
