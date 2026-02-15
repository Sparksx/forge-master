import {
    EQUIPMENT_TYPES, MAX_LEVEL, SAVE_KEY, BONUS_STAT_KEYS, HEALTH_ITEMS,
    HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, TIERS, FORGE_LEVELS, MAX_FORGE_LEVEL,
    GROWTH_EXPONENT, SPEED_UP_SECONDS_PER_DIAMOND, STARTING_DIAMONDS,
    LEVEL_REWARD_BASE_GOLD, LEVEL_REWARD_GOLD_PER_LEVEL,
    LEVEL_MILESTONE_INTERVAL, LEVEL_MILESTONE_MULTIPLIER,
    PROFILE_PICTURES
} from './config.js';
import { TECHS, getTechById } from './tech-config.js';
import { SKILLS, getSkillById as getSkillDef, MAX_EQUIPPED_SKILLS, getSkillMaxLevel, getSkillLevelFromCopies } from './skills-config.js';
import { gameEvents, EVENTS } from './events.js';
import { apiFetch, getAccessToken } from './api.js';

function createEmptyEquipment() {
    const equipment = {};
    EQUIPMENT_TYPES.forEach(type => { equipment[type] = null; });
    return equipment;
}

function isValidItem(item, maxLevel = MAX_LEVEL) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.type !== 'string' || !EQUIPMENT_TYPES.includes(item.type)) return false;
    if (typeof item.level !== 'number' || !Number.isInteger(item.level)) return false;
    if (item.level < 1 || item.level > maxLevel) return false;
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

export function getLevelReward(level) {
    const baseGold = LEVEL_REWARD_BASE_GOLD + level * LEVEL_REWARD_GOLD_PER_LEVEL;
    const isMilestone = level % LEVEL_MILESTONE_INTERVAL === 0;
    const gold = isMilestone ? baseGold * LEVEL_MILESTONE_MULTIPLIER : baseGold;
    return { gold, isMilestone };
}

function createEmptyForgeTracker() {
    const tracker = {};
    EQUIPMENT_TYPES.forEach(type => { tracker[type] = {}; });
    return tracker;
}

const gameState = {
    equipment: createEmptyEquipment(),
    forgedItem: null,
    gold: 0,
    forgeLevel: 1,
    forgeUpgrade: null, // { targetLevel, startedAt, duration } or null
    forgeHighestLevel: createEmptyForgeTracker(), // { [type]: { [tier]: maxLevel } }
    combat: {
        currentWave: 1,
        currentSubWave: 1,
        highestWave: 1,
        highestSubWave: 1,
    },
    player: {
        level: 1,
        xp: 0,
        profilePicture: 'wizard',
    },
    // Premium currency
    diamonds: STARTING_DIAMONDS,
    // Tech tree
    essence: 0,
    research: {
        completed: {},   // { [techId]: level }
        active: null,    // { techId, level, startedAt, duration } or null
        queue: [],       // [{ techId, level }]
    },
    // Skills
    skills: {
        unlocked: {},   // { [skillId]: level }  (level >= 1 means unlocked)
        equipped: [],   // [skillId, ...] max 3
        copies: {},     // { [skillId]: totalCopiesForged }
        shards: 0,      // earned through combat sub-wave completions
    },
    // Counters
    totalItemsSold: 0,
    // Shop state (persisted with game save to prevent re-claiming after cache clear)
    shopState: {
        claimedMilestones: [],
        dailyLastClaimed: null,
        dailyStreak: 0,
    },
};

export function resetGame() {
    gameState.equipment = createEmptyEquipment();
    gameState.forgedItem = null;
    gameState.gold = 0;
    gameState.forgeLevel = 1;
    gameState.forgeUpgrade = null;
    gameState.forgeHighestLevel = createEmptyForgeTracker();
    gameState.combat = { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 };
    gameState.player = { level: 1, xp: 0, profilePicture: 'wizard' };
    gameState.diamonds = STARTING_DIAMONDS;
    gameState.essence = 0;
    gameState.research = { completed: {}, active: null, queue: [] };
    gameState.skills = { unlocked: {}, equipped: [], copies: {}, shards: 0 };
    gameState.totalItemsSold = 0;
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

        // Grant level reward
        const reward = getLevelReward(gameState.player.level);
        gameState.gold += reward.gold;

        gameEvents.emit(EVENTS.PLAYER_LEVEL_UP, {
            level: gameState.player.level,
            reward,
        });
    }

    if (gameState.player.level >= MAX_PLAYER_LEVEL) {
        gameState.player.xp = 0;
    }

    saveGame();
    if (leveled) gameEvents.emit(EVENTS.STATE_CHANGED);
}

// --- Profile picture ---

export function getProfilePicture() {
    return gameState.player.profilePicture || 'wizard';
}

export function setProfilePicture(pictureId) {
    const valid = PROFILE_PICTURES.some(p => p.id === pictureId);
    if (!valid) return false;
    gameState.player.profilePicture = pictureId;
    saveGame();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    // Persist to server
    if (getAccessToken()) {
        apiFetch('/api/auth/profile-picture', {
            method: 'PUT',
            body: { profilePicture: pictureId },
        }).catch(() => {});
    }
    return true;
}

export function getProfileEmoji() {
    const pic = PROFILE_PICTURES.find(p => p.id === getProfilePicture());
    return pic ? pic.emoji : '\uD83E\uDDD9';
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

export function getHighestLevelForSlot(type, tier) {
    const tierStr = String(tier);
    return gameState.forgeHighestLevel[type]?.[tierStr] ?? null;
}

export function trackForgedLevel(type, tier, level) {
    const tierStr = String(tier);
    if (!gameState.forgeHighestLevel[type]) {
        gameState.forgeHighestLevel[type] = {};
    }
    const current = gameState.forgeHighestLevel[type][tierStr] ?? 0;
    if (level > current) {
        gameState.forgeHighestLevel[type][tierStr] = level;
    }
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

export function getTotalItemsSold() {
    return gameState.totalItemsSold;
}

// Centralized counter: increment on every ITEM_SOLD event regardless of source
gameEvents.on(EVENTS.ITEM_SOLD, () => {
    gameState.totalItemsSold++;
    saveGame();
});

export function addGold(amount) {
    gameState.gold += amount;
    saveGame();
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

// --- Diamonds (premium currency) ---

export function getDiamonds() {
    return gameState.diamonds;
}

export function addDiamonds(amount) {
    gameState.diamonds += amount;
    saveGame();
    gameEvents.emit(EVENTS.DIAMONDS_CHANGED, gameState.diamonds);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function spendDiamonds(amount) {
    if (gameState.diamonds < amount) return false;
    gameState.diamonds -= amount;
    saveGame();
    gameEvents.emit(EVENTS.DIAMONDS_CHANGED, gameState.diamonds);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

export function getForgeLevel() {
    return gameState.forgeLevel;
}

export function getSellValue(item) {
    const base = item.level * (item.tier || 1);
    const goldRushPct = getTechEffect('goldRush'); // +20% per level
    return Math.floor(base * (1 + goldRushPct / 100));
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

    const isAdminMode = typeof window !== 'undefined' && window.__adminMode;

    if (!isAdminMode && gameState.gold < cost) return false;

    const duration = getForgeUpgradeTime();
    if (!isAdminMode) gameState.gold -= cost;

    if (duration === 0 || isAdminMode) {
        // Instant upgrade (level 1 has time=0, admin mode, or initial state)
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
    const speedUpCost = Math.ceil(remaining / SPEED_UP_SECONDS_PER_DIAMOND);
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
    if (gameState.diamonds < status.speedUpCost) return false;

    gameState.diamonds -= status.speedUpCost;
    gameState.forgeLevel = gameState.forgeUpgrade.targetLevel;
    gameState.forgeUpgrade = null;
    saveGame();
    gameEvents.emit(EVENTS.DIAMONDS_CHANGED, gameState.diamonds);
    gameEvents.emit(EVENTS.FORGE_UPGRADED, gameState.forgeLevel);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// Legacy wrapper for backward compat in tests
export function upgradeForge() {
    return startForgeUpgrade();
}

export function equipItem(item, { studyOld = false } = {}) {
    const oldItem = gameState.equipment[item.type];
    if (oldItem && !studyOld) {
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

// --- Essence & Research state ---

export function getEssence() {
    return gameState.essence;
}

export function addEssence(amount) {
    gameState.essence += amount;
    saveGame();
    gameEvents.emit(EVENTS.ESSENCE_CHANGED, gameState.essence);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function spendEssence(amount) {
    if (gameState.essence < amount) return false;
    gameState.essence -= amount;
    saveGame();
    gameEvents.emit(EVENTS.ESSENCE_CHANGED, gameState.essence);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

export function getStudyValue(item) {
    return item.level * (item.tier || 1) * (item.tier || 1);
}

export function getResearchState() {
    return gameState.research;
}

export function getTechLevel(techId) {
    return gameState.research.completed[techId] || 0;
}

export function setResearchActive(active) {
    gameState.research.active = active;
    saveGame();
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function completeResearch(techId, level) {
    gameState.research.completed[techId] = level;
    gameState.research.active = null;
    saveGame();
    gameEvents.emit(EVENTS.RESEARCH_COMPLETED, { techId, level });
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function getResearchQueue() {
    return gameState.research.queue;
}

export function addToResearchQueue(entry) {
    gameState.research.queue.push(entry);
    saveGame();
    gameEvents.emit(EVENTS.RESEARCH_QUEUED, entry);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function shiftResearchQueue() {
    const next = gameState.research.queue.shift();
    saveGame();
    return next || null;
}

// --- Skills state ---

export function getSkillsState() {
    return gameState.skills;
}

export function setSkillUnlocked(skillId, level) {
    gameState.skills.unlocked[skillId] = level;
}

export function setSkillLevel(skillId, level) {
    gameState.skills.unlocked[skillId] = level;
}

export function getEquippedSkills() {
    return gameState.skills.equipped;
}

export function setEquippedSkills(equipped) {
    gameState.skills.equipped = equipped;
}

// --- Skill Shards (embedded in skills JSON for DB persistence) ---

export function getSkillShards() {
    return gameState.skills.shards || 0;
}

export function addSkillShards(amount) {
    gameState.skills.shards = (gameState.skills.shards || 0) + amount;
    saveGame();
    gameEvents.emit(EVENTS.SKILL_SHARDS_CHANGED, gameState.skills.shards);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export function spendSkillShards(amount) {
    if ((gameState.skills.shards || 0) < amount) return false;
    gameState.skills.shards -= amount;
    saveGame();
    gameEvents.emit(EVENTS.SKILL_SHARDS_CHANGED, gameState.skills.shards);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// --- Skill Copies ---

export function getSkillCopies(skillId) {
    return gameState.skills.copies[skillId] || 0;
}

export function getAllSkillCopies() {
    return { ...gameState.skills.copies };
}

export function addSkillCopy(skillId) {
    if (!gameState.skills.copies[skillId]) {
        gameState.skills.copies[skillId] = 0;
    }
    gameState.skills.copies[skillId]++;
    // First copy always unlocks at level 1
    if (gameState.skills.copies[skillId] === 1 && !gameState.skills.unlocked[skillId]) {
        gameState.skills.unlocked[skillId] = 1;
    }
}

/** Check if a skill can be upgraded based on copies collected */
export function canUpgradeSkillFromCopies(skillId) {
    const skill = getSkillDef(skillId);
    if (!skill) return false;
    const currentLevel = gameState.skills.unlocked[skillId] || 0;
    if (currentLevel <= 0) return false;
    const maxLevel = getSkillMaxLevel(skill);
    if (currentLevel >= maxLevel) return false;
    const copies = gameState.skills.copies[skillId] || 0;
    const possibleLevel = getSkillLevelFromCopies(copies, maxLevel);
    return possibleLevel > currentLevel;
}

/** Upgrade a skill to the next level if enough copies */
export function upgradeSkillFromCopies(skillId) {
    if (!canUpgradeSkillFromCopies(skillId)) return false;
    const skill = getSkillDef(skillId);
    const maxLevel = getSkillMaxLevel(skill);
    const copies = gameState.skills.copies[skillId] || 0;
    const newLevel = getSkillLevelFromCopies(copies, maxLevel);
    gameState.skills.unlocked[skillId] = newLevel;
    saveGame();
    return newLevel;
}

/** Get effective value of a tech effect for game systems */
export function getTechEffect(effectType) {
    let total = 0;
    for (const tech of TECHS) {
        if (tech.effect.type === effectType) {
            const level = getTechLevel(tech.id);
            if (level > 0) {
                total += tech.effect.perLevel * level;
            }
        }
    }
    return total;
}

let saveTimeout = null;
let saveInFlight = false;
let saveDirtyWhileInFlight = false;
const SAVE_DEBOUNCE = 2000; // 2 seconds

export function getShopState() {
    return gameState.shopState;
}

export function setShopState(newState) {
    gameState.shopState = { ...gameState.shopState, ...newState };
}

function buildSaveData() {
    const data = {
        equipment: gameState.equipment,
        gold: gameState.gold,
        forgeLevel: gameState.forgeLevel,
        forgeHighestLevel: gameState.forgeHighestLevel,
        forgeUpgrade: gameState.forgeUpgrade || null,
        combat: gameState.combat,
        // Embed shopState and totalItemsSold inside player JSON so they persist on server without schema changes
        player: { ...gameState.player, shopState: gameState.shopState, totalItemsSold: gameState.totalItemsSold },
        diamonds: gameState.diamonds,
        essence: gameState.essence,
        research: gameState.research,
        skills: gameState.skills,
        totalItemsSold: gameState.totalItemsSold,
    };
    return data;
}

export function saveGame() {
    // Always save to localStorage as fallback
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
    } catch (error) {
        console.error('Error saving game locally:', error);
    }

    // Debounced save to server with in-flight protection
    if (getAccessToken()) {
        if (saveInFlight) {
            // A save is already in progress — mark dirty so we re-save when it finishes
            saveDirtyWhileInFlight = true;
            return;
        }
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToServer, SAVE_DEBOUNCE);
    }
}

async function saveToServer() {
    saveTimeout = null;
    saveInFlight = true;
    saveDirtyWhileInFlight = false;
    try {
        await apiFetch('/api/game/state', {
            method: 'PUT',
            body: buildSaveData(),
        });
    } catch (error) {
        console.error('Error saving game to server:', error);
    } finally {
        saveInFlight = false;
        // If state changed while we were saving, schedule another save
        if (saveDirtyWhileInFlight) {
            saveDirtyWhileInFlight = false;
            if (getAccessToken()) {
                saveTimeout = setTimeout(saveToServer, SAVE_DEBOUNCE);
            }
        }
    }
}

// Flush any pending debounced save immediately (used on page hide/unload)
function flushSaveToServer() {
    if ((saveTimeout || saveDirtyWhileInFlight) && getAccessToken()) {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = null;
        saveDirtyWhileInFlight = false;
        saveToServer();
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushSaveToServer();
    });
    window.addEventListener('beforeunload', flushSaveToServer);
}

function applyLoadedData(loaded) {
    if (typeof loaded !== 'object' || loaded === null) return;

    // ── Restore research state FIRST so tech effects (mastery bonuses) are
    //    available when validating equipment levels below.
    if (loaded.research && typeof loaded.research === 'object') {
        if (loaded.research.completed && typeof loaded.research.completed === 'object') {
            gameState.research.completed = {};
            for (const [techId, level] of Object.entries(loaded.research.completed)) {
                const tech = getTechById(techId);
                if (tech && typeof level === 'number' && level >= 1) {
                    gameState.research.completed[techId] = Math.min(level, tech.maxLevel);
                }
            }
        }
        if (loaded.research.active && typeof loaded.research.active === 'object') {
            const { techId, level, startedAt, duration } = loaded.research.active;
            if (techId && typeof startedAt === 'number' && typeof duration === 'number') {
                const elapsed = (Date.now() - startedAt) / 1000;
                if (elapsed >= duration) {
                    // Research completed while offline
                    gameState.research.completed[techId] = level;
                    gameState.research.active = null;
                } else {
                    gameState.research.active = { techId, level, startedAt, duration };
                }
            }
        }
        if (Array.isArray(loaded.research.queue)) {
            gameState.research.queue = loaded.research.queue.filter(
                q => q && q.techId && typeof q.level === 'number'
            );
        }
    }

    // Support both old format (flat equipment) and new format ({equipment, gold})
    const equipmentData = loaded.equipment || loaded;

    EQUIPMENT_TYPES.forEach(type => {
        // Compute effective max level for this slot using mastery tech bonuses
        const effectiveMaxLevel = MAX_LEVEL + getTechEffect(`${type}Mastery`);
        if (isValidItem(equipmentData[type], effectiveMaxLevel)) {
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

    // Restore per-slot forge level tracker
    if (loaded.forgeHighestLevel && typeof loaded.forgeHighestLevel === 'object') {
        EQUIPMENT_TYPES.forEach(type => {
            if (loaded.forgeHighestLevel[type] && typeof loaded.forgeHighestLevel[type] === 'object') {
                const slotMaxLevel = MAX_LEVEL + getTechEffect(`${type}Mastery`);
                gameState.forgeHighestLevel[type] = {};
                for (const [tier, level] of Object.entries(loaded.forgeHighestLevel[type])) {
                    if (typeof level === 'number' && level >= 1 && level <= slotMaxLevel) {
                        gameState.forgeHighestLevel[type][tier] = Math.floor(level);
                    }
                }
            }
        });
    }

    // Restore combat progress
    if (loaded.combat && typeof loaded.combat === 'object') {
        const { currentWave, currentSubWave, highestWave, highestSubWave } = loaded.combat;
        const maxWaves = 10 + getTechEffect('waveBreaker');
        if (typeof currentWave === 'number' && currentWave >= 1 && currentWave <= maxWaves) {
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

    // Restore player level/XP/profilePicture
    if (loaded.player && typeof loaded.player === 'object') {
        if (typeof loaded.player.level === 'number' && loaded.player.level >= 1 && loaded.player.level <= MAX_PLAYER_LEVEL) {
            gameState.player.level = Math.floor(loaded.player.level);
        }
        if (typeof loaded.player.xp === 'number' && loaded.player.xp >= 0) {
            gameState.player.xp = Math.floor(loaded.player.xp);
        }
        if (typeof loaded.player.profilePicture === 'string' && PROFILE_PICTURES.some(p => p.id === loaded.player.profilePicture)) {
            gameState.player.profilePicture = loaded.player.profilePicture;
        }
    }

    // Restore diamonds (premium currency)
    if (typeof loaded.diamonds === 'number' && loaded.diamonds >= 0) {
        gameState.diamonds = Math.floor(loaded.diamonds);
    }

    // Restore essence
    if (typeof loaded.essence === 'number' && loaded.essence >= 0) {
        gameState.essence = Math.floor(loaded.essence);
    }

    // NOTE: Research state is restored at the top of applyLoadedData() so that
    // tech effects (mastery bonuses) are available when validating equipment levels.

    // Restore skills state
    if (loaded.skills && typeof loaded.skills === 'object') {
        // Restore copies first
        if (loaded.skills.copies && typeof loaded.skills.copies === 'object') {
            gameState.skills.copies = {};
            for (const [skillId, copies] of Object.entries(loaded.skills.copies)) {
                const skill = getSkillDef(skillId);
                if (skill && typeof copies === 'number' && copies >= 0) {
                    gameState.skills.copies[skillId] = Math.floor(copies);
                }
            }
        }

        // Restore shards (embedded in skills JSON for DB persistence)
        const shardsValue = loaded.skills.shards ?? loaded.skillShards ?? 0;
        if (typeof shardsValue === 'number' && shardsValue >= 0) {
            gameState.skills.shards = Math.floor(shardsValue);
        }

        if (loaded.skills.unlocked && typeof loaded.skills.unlocked === 'object') {
            gameState.skills.unlocked = {};
            for (const [skillId, level] of Object.entries(loaded.skills.unlocked)) {
                const skill = getSkillDef(skillId);
                if (skill && typeof level === 'number' && level >= 1 && level <= getSkillMaxLevel(skill)) {
                    gameState.skills.unlocked[skillId] = level;
                }
            }
        }
        if (Array.isArray(loaded.skills.equipped)) {
            gameState.skills.equipped = loaded.skills.equipped.filter(id => {
                return typeof id === 'string' && gameState.skills.unlocked[id];
            }).slice(0, MAX_EQUIPPED_SKILLS);
        }
    }

    // Restore shop state (milestones + daily rewards)
    // shopState is embedded inside player JSON for server persistence (no schema change needed)
    const shopData = (loaded.shopState && typeof loaded.shopState === 'object')
        ? loaded.shopState
        : (loaded.player?.shopState && typeof loaded.player.shopState === 'object')
            ? loaded.player.shopState
            : null;
    if (shopData) {
        if (Array.isArray(shopData.claimedMilestones)) {
            gameState.shopState.claimedMilestones = shopData.claimedMilestones;
        }
        if (typeof shopData.dailyLastClaimed === 'string' || shopData.dailyLastClaimed === null) {
            gameState.shopState.dailyLastClaimed = shopData.dailyLastClaimed;
        }
        if (typeof shopData.dailyStreak === 'number' && shopData.dailyStreak >= 0) {
            gameState.shopState.dailyStreak = Math.floor(shopData.dailyStreak);
        }
    }

    // Restore items sold counter (may be at top level or embedded in player JSON)
    const totalSold = loaded.totalItemsSold ?? loaded.player?.totalItemsSold ?? 0;
    if (typeof totalSold === 'number' && totalSold >= 0) {
        gameState.totalItemsSold = Math.floor(totalSold);
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
