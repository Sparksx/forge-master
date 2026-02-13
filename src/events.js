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
    ITEM_SOLD: 'item:sold',
    GOLD_PURCHASED: 'gold:purchased',
    GAME_LOADED: 'game:loaded',
    FORGE_UPGRADED: 'forge:upgraded',
    COMBAT_START: 'combat:start',
    COMBAT_TICK: 'combat:tick',
    COMBAT_PLAYER_HIT: 'combat:player_hit',
    COMBAT_MONSTER_HIT: 'combat:monster_hit',
    COMBAT_PLAYER_CRIT: 'combat:player_crit',
    COMBAT_PLAYER_LIFESTEAL: 'combat:player_lifesteal',
    COMBAT_MONSTER_DEFEATED: 'combat:monster_defeated',
    COMBAT_PLAYER_DEFEATED: 'combat:player_defeated',
    COMBAT_WAVE_CHANGED: 'combat:wave_changed',
    COMBAT_FOCUS_CHANGED: 'combat:focus_changed',
    COMBAT_SUBWAVE_CLEARED: 'combat:subwave_cleared',
    PLAYER_LEVEL_UP: 'player:level_up',
    RESEARCH_STARTED: 'research:started',
    RESEARCH_COMPLETED: 'research:completed',
    RESEARCH_QUEUED: 'research:queued',
    ESSENCE_CHANGED: 'essence:changed',
    DIAMONDS_CHANGED: 'diamonds:changed',
    // Skills
    SKILL_UNLOCKED: 'skill:unlocked',
    SKILL_LEVELED: 'skill:leveled',
    SKILL_EQUIPPED: 'skill:equipped',
    SKILL_UNEQUIPPED: 'skill:unequipped',
    SKILL_ACTIVATED: 'skill:activated',
    SKILL_EXPIRED: 'skill:expired',
    SKILL_COOLDOWN_READY: 'skill:cooldown_ready',
    // Skill forge
    SKILL_FORGED: 'skill:forged',
    SKILL_SHARDS_CHANGED: 'skill:shards_changed',
    // Locale
    LOCALE_CHANGED: 'locale:changed',
};
