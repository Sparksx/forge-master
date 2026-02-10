import {
    EQUIPMENT_TYPES, MAX_LEVEL, SAVE_KEY, BONUS_STAT_KEYS, HEALTH_ITEMS,
    HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, TIERS, FORGE_LEVELS, MAX_FORGE_LEVEL,
    GROWTH_EXPONENT, SPEED_UP_GOLD_PER_SECOND
} from './config.js';
import { gameEvents, EVENTS } from './events.js';
import { apiFetch, getAccessToken } from './api.js';

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

// --- Player level / XP system ---
const MAX_PLAYER_LEVEL = 100;
const BASE_XP_PER_LEVEL = 150;
const XP_GROWTH = 1.3;

export function xpRequiredForLevel(level) {
    return Math.floor(BASE_XP_PER_LEVEL * Math.pow(level, XP_GROWTH));
}

const gameState = {
    equipment: createEmptyEquipment(),
    forgedItem: null,
    gold: 0,
    forgeLevel: 1,
    forgeUpgrade: null, // { targetLevel, startedAt, duration } or null
    combat: {
        currentWave: 1,
        currentSubWave: 1,
        highestWave: 1,
        highestSubWave: 1,
    },
    player: {
        level: 1,
        xp: 0,
    },
};

export function resetGame() {
    gameState.equipment = createEmptyEquipment();
    gameState.forgedItem = null;
    gameState.gold = 0;
    gameState.forgeLevel = 1;
    gameState.forgeUpgrade = null;
    gameState.combat = { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 };
    gameState.player = { level: 1, xp: 0 };
}

// --- Player level getters / setters ---

export function getPlayerLevel() {
    return gameState.player.level;
}

export function getPlayerXP() {
    return gameState.player.xp;
}

export function getXPToNextLevel() {
    if (gameState.player.level >= MAX_PLAYER_LEVEL) return 0;
    return xpRequiredForLevel(gameState.player.level);
}

export function addXP(amount) {
    if (gameState.player.level >= MAX_PLAYER_LEVEL) return;
    gameState.player.xp += amount;

    let leveled = false;
    while (gameState.player.level < MAX_PLAYER_LEVEL) {
        const needed = xpRequiredForLevel(gameState.player.level);
        if (gameState.player.xp < needed) break;
        gameState.player.xp -= needed;
        gameState.player.level += 1;
        leveled = true;
        gameEvents.emit(EVENTS.PLAYER_LEVEL_UP, { level: gameState.player.level });
    }

    if (gameState.player.level >= MAX_PLAYER_LEVEL) {
        gameState.player.xp = 0;
    }

    saveGame();
    if (leveled) gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function getEquipment() {
    return gameState.equipment;
}

export function getEquipmentByType(type) {
    return gameState.equipment[type];
}

export function getHighestLevelForTier(tier) {
    let highest = null;
    Object.values(gameState.equipment).forEach(item => {
        if (item && item.tier === tier) {
            if (highest === null || item.level > highest) {
                highest = item.level;
            }
        }
    });
    return highest;
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

export function getForgeUpgradeTime() {
    if (gameState.forgeLevel >= MAX_FORGE_LEVEL) return null;
    return FORGE_LEVELS[gameState.forgeLevel].time;
}

export function getForgeUpgradeState() {
    return gameState.forgeUpgrade;
}

export function startForgeUpgrade() {
    if (gameState.forgeUpgrade) return false; // already upgrading
    const cost = getForgeUpgradeCost();
    if (cost === null) return false;
    if (gameState.gold < cost) return false;

    const duration = getForgeUpgradeTime();
    gameState.gold -= cost;

    if (duration === 0) {
        // Instant upgrade (level 1 has time=0, but cost=0 so it's the initial state)
        gameState.forgeLevel += 1;
        saveGame();
        gameEvents.emit(EVENTS.FORGE_UPGRADED, gameState.forgeLevel);
        gameEvents.emit(EVENTS.STATE_CHANGED);
        return true;
    }

    gameState.forgeUpgrade = {
        targetLevel: gameState.forgeLevel + 1,
        startedAt: Date.now(),
        duration, // seconds
    };
    saveGame();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

export function getForgeUpgradeStatus() {
    if (!gameState.forgeUpgrade) return null;
    const { startedAt, duration } = gameState.forgeUpgrade;
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = Math.max(0, duration - elapsed);
    const progress = Math.min(1, elapsed / duration);
    const speedUpCost = Math.ceil(remaining * SPEED_UP_GOLD_PER_SECOND);
    return { remaining, progress, speedUpCost, duration };
}

export function checkForgeUpgradeComplete() {
    if (!gameState.forgeUpgrade) return false;
    const status = getForgeUpgradeStatus();
    if (status.remaining <= 0) {
        gameState.forgeLevel = gameState.forgeUpgrade.targetLevel;
        gameState.forgeUpgrade = null;
        saveGame();
        gameEvents.emit(EVENTS.FORGE_UPGRADED, gameState.forgeLevel);
        gameEvents.emit(EVENTS.STATE_CHANGED);
        return true;
    }
    return false;
}

export function speedUpForgeUpgrade() {
    if (!gameState.forgeUpgrade) return false;
    const status = getForgeUpgradeStatus();
    if (!status || status.remaining <= 0) {
        return checkForgeUpgradeComplete();
    }
    if (gameState.gold < status.speedUpCost) return false;

    gameState.gold -= status.speedUpCost;
    gameState.forgeLevel = gameState.forgeUpgrade.targetLevel;
    gameState.forgeUpgrade = null;
    saveGame();
    gameEvents.emit(EVENTS.FORGE_UPGRADED, gameState.forgeLevel);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// Legacy wrapper for backward compat in tests
export function upgradeForge() {
    return startForgeUpgrade();
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

// --- Combat state ---

export function getCombatProgress() {
    return { ...gameState.combat };
}

export function setCombatWave(wave, subWave) {
    gameState.combat.currentWave = wave;
    gameState.combat.currentSubWave = subWave;
    if (wave > gameState.combat.highestWave ||
        (wave === gameState.combat.highestWave && subWave > gameState.combat.highestSubWave)) {
        gameState.combat.highestWave = wave;
        gameState.combat.highestSubWave = subWave;
    }
    saveGame();
    gameEvents.emit(EVENTS.COMBAT_WAVE_CHANGED, { wave, subWave });
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

let saveTimeout = null;
const SAVE_DEBOUNCE = 2000; // 2 seconds

export function saveGame() {
    // Always save to localStorage as fallback
    try {
        const data = {
            equipment: gameState.equipment,
            gold: gameState.gold,
            forgeLevel: gameState.forgeLevel,
            combat: gameState.combat,
            player: gameState.player,
        };
        if (gameState.forgeUpgrade) {
            data.forgeUpgrade = gameState.forgeUpgrade;
        }
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving game locally:', error);
    }

    // Debounced save to server
    if (getAccessToken()) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToServer, SAVE_DEBOUNCE);
    }
}

async function saveToServer() {
    try {
        const data = {
            equipment: gameState.equipment,
            gold: gameState.gold,
            forgeLevel: gameState.forgeLevel,
            forgeUpgrade: gameState.forgeUpgrade || null,
            combat: gameState.combat,
            player: gameState.player,
        };
        await apiFetch('/api/game/state', {
            method: 'PUT',
            body: data,
        });
    } catch (error) {
        console.error('Error saving game to server:', error);
    }
}

function applyLoadedData(loaded) {
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

    // Restore combat progress
    if (loaded.combat && typeof loaded.combat === 'object') {
        const { currentWave, currentSubWave, highestWave, highestSubWave } = loaded.combat;
        if (typeof currentWave === 'number' && currentWave >= 1 && currentWave <= 10) {
            gameState.combat.currentWave = Math.floor(currentWave);
        }
        if (typeof currentSubWave === 'number' && currentSubWave >= 1 && currentSubWave <= 10) {
            gameState.combat.currentSubWave = Math.floor(currentSubWave);
        }
        if (typeof highestWave === 'number' && highestWave >= 1) {
            gameState.combat.highestWave = Math.floor(highestWave);
        }
        if (typeof highestSubWave === 'number' && highestSubWave >= 1) {
            gameState.combat.highestSubWave = Math.floor(highestSubWave);
        }
    }

    // Restore player level/XP
    if (loaded.player && typeof loaded.player === 'object') {
        if (typeof loaded.player.level === 'number' && loaded.player.level >= 1 && loaded.player.level <= MAX_PLAYER_LEVEL) {
            gameState.player.level = Math.floor(loaded.player.level);
        }
        if (typeof loaded.player.xp === 'number' && loaded.player.xp >= 0) {
            gameState.player.xp = Math.floor(loaded.player.xp);
        }
    }

    // Restore forge upgrade timer
    if (loaded.forgeUpgrade && typeof loaded.forgeUpgrade === 'object') {
        const { targetLevel, startedAt, duration } = loaded.forgeUpgrade;
        if (typeof targetLevel === 'number' && typeof startedAt === 'number' && typeof duration === 'number') {
            const elapsed = (Date.now() - startedAt) / 1000;
            if (elapsed >= duration) {
                // Upgrade completed while offline
                gameState.forgeLevel = Math.min(targetLevel, MAX_FORGE_LEVEL);
                gameState.forgeUpgrade = null;
            } else {
                gameState.forgeUpgrade = { targetLevel, startedAt, duration };
            }
        }
    }
}

export function loadGame() {
    try {
        const savedData = localStorage.getItem(SAVE_KEY);
        if (!savedData) return;

        const loaded = JSON.parse(savedData);
        applyLoadedData(loaded);

        gameEvents.emit(EVENTS.GAME_LOADED);
        gameEvents.emit(EVENTS.STATE_CHANGED);
    } catch (error) {
        console.error('Error loading save:', error);
    }
}

export async function loadGameFromServer() {
    try {
        const res = await apiFetch('/api/game/state');
        if (!res.ok) {
            console.warn('Failed to load from server, falling back to localStorage');
            loadGame();
            return;
        }
        const loaded = await res.json();
        applyLoadedData(loaded);

        gameEvents.emit(EVENTS.GAME_LOADED);
        gameEvents.emit(EVENTS.STATE_CHANGED);
    } catch (error) {
        console.error('Error loading from server:', error);
        loadGame(); // fallback
    }
}
