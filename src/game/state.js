// Game state: equipment, gold, forge level, arena rank, avatar.
// Persists via the existing /api/game/state endpoint (+ localStorage fallback).
import {
    EQUIPMENT_TYPES, HEALTH_ITEMS, MAX_TIER, MAX_ITEM_LEVEL, SAVE_KEY, STARTING_GOLD,
    FORGE_LEVELS, MAX_FORGE_LEVEL, MAX_PLAYER_LEVEL, AVATARS, calculateItemStats,
    computeStatsFromEquipment, playerPowerScore, powerBreakdown,
    forgeXpForLevel, playerXpForLevel,
} from './config.js';
import { getCosmetic, isFreeCosmetic } from '../../shared/cosmetics.js';
import { itemName } from './items.js';
import { gameEvents, EVENTS } from '../events.js';
import { apiFetch, getAccessToken } from '../api.js';

function emptyEquipment() {
    const e = {};
    EQUIPMENT_TYPES.forEach((t) => { e[t] = null; });
    return e;
}

const state = {
    equipment: emptyEquipment(),
    gold: STARTING_GOLD,
    forgeLevel: 1,
    forgeXp: 0,            // XP toward the next forge level (resets each level)
    bestLevels: {},        // { [type]: { [tier]: level } }
    arenaRank: 1,
    highestArenaRank: 1,
    playerLevel: 1,
    playerXp: 0,           // XP toward the next player level (resets each level)
    avatar: 'wizard',
    ownedCosmetics: [],    // ids of gold-bought cosmetics (premium avatars + frames)
    frame: 'none',         // equipped profile frame (purely visual)
    // Clan perks, refreshed by clan.js after loading the player's clan.
    perks: { goldBonusPct: 0, forgeLuckPct: 0, forgeSpeedPct: 0, forgeBestOf: 1, statBonusPct: 0 },
};

// ── Validation / migration ────────────────────────────────────────────────
function isValidItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (!EQUIPMENT_TYPES.includes(item.type)) return false;
    if (typeof item.level !== 'number' || item.level < 1 || item.level > MAX_ITEM_LEVEL) return false;
    if (typeof item.tier !== 'number' || item.tier < 1 || item.tier > MAX_TIER) return false;
    return true;
}

function normalizeItem(raw) {
    const type = raw.type;
    const tier = Math.floor(raw.tier);
    const level = Math.floor(raw.level);
    const isHealth = HEALTH_ITEMS.includes(type);
    const item = {
        type, level, tier,
        stats: calculateItemStats(level, tier, isHealth),
        statType: isHealth ? 'health' : 'damage',
        bonuses: Array.isArray(raw.bonuses)
            ? raw.bonuses.filter((b) => b && typeof b.type === 'string' && typeof b.value === 'number')
            : [],
    };
    // Weapons carry a melee/ranged style; default legacy saves to melee.
    if (type === 'weapon') {
        item.attackStyle = raw.attackStyle === 'ranged' ? 'ranged' : 'melee';
    }
    item.name = raw.name || itemName(item);
    return item;
}

// ── Getters ───────────────────────────────────────────────────────────────
export const getGold = () => state.gold;
export const getEquipment = () => state.equipment;
export const getEquippedItem = (type) => state.equipment[type];
export const getForgeLevel = () => state.forgeLevel;
export const getArenaRank = () => state.arenaRank;
export const getHighestArenaRank = () => state.highestArenaRank;
export const getPlayerLevel = () => state.playerLevel;
export const getAvatar = () => state.avatar;
export const getFrame = () => state.frame || 'none';
export const getOwnedCosmetics = () => state.ownedCosmetics.slice();
export const getForgeLuckPct = () => state.perks.forgeLuckPct || 0;

const FREE_AVATAR_IDS = new Set(AVATARS.map((a) => a.id));

/** True if the player can wear this cosmetic (free items + anything bought). */
export function ownsCosmetic(id) {
    if (!id) return false;
    if (FREE_AVATAR_IDS.has(id)) return true; // the base avatar roster is always free
    if (isFreeCosmetic(id)) return true;      // the `none` frame
    return state.ownedCosmetics.includes(id);
}
export const getGoldBonusPct = () => state.perks.goldBonusPct || 0;
export const getForgeSpeedPct = () => state.perks.forgeSpeedPct || 0;
export const getForgeBestOf = () => Math.max(1, state.perks.forgeBestOf || 1);
export const getStatBonusPct = () => state.perks.statBonusPct || 0;

/** Player XP progress toward the next level: { level, xp, need, pct, maxed }. */
export function getPlayerLevelProgress() {
    const maxed = state.playerLevel >= MAX_PLAYER_LEVEL;
    const need = maxed ? 0 : playerXpForLevel(state.playerLevel);
    return {
        level: state.playerLevel,
        xp: state.playerXp,
        need,
        pct: maxed || need <= 0 ? 1 : Math.min(1, state.playerXp / need),
        maxed,
    };
}

/** Forge XP progress toward the next forge level: { level, xp, need, pct, maxed }. */
export function getForgeLevelProgress() {
    const maxed = state.forgeLevel >= MAX_FORGE_LEVEL;
    const need = maxed ? 0 : forgeXpForLevel(state.forgeLevel);
    return {
        level: state.forgeLevel,
        xp: state.forgeXp,
        need,
        pct: maxed || need <= 0 ? 1 : Math.min(1, state.forgeXp / need),
        maxed,
    };
}

export function getCombatStats() {
    return computeStatsFromEquipment(state.equipment, state.playerLevel, getStatBonusPct());
}

export function getPowerScore() {
    return playerPowerScore(state.equipment, state.playerLevel, getStatBonusPct());
}

/** Itemized power breakdown (base + gear per stat, formula steps) for the Power page. */
export function getPowerBreakdown() {
    return powerBreakdown(state.equipment, state.playerLevel, getStatBonusPct());
}

export function getBestLevelForSlot(type, tier) {
    return state.bestLevels[type]?.[tier] ?? null;
}

export function recordForgedLevel(type, tier, level) {
    if (!state.bestLevels[type]) state.bestLevels[type] = {};
    const cur = state.bestLevels[type][tier] ?? 0;
    if (level > cur) state.bestLevels[type][tier] = level;
}

// ── Forge level ───────────────────────────────────────────────────────────
export function getForgeUpgradeCost() {
    if (state.forgeLevel >= MAX_FORGE_LEVEL) return null;
    return FORGE_LEVELS[state.forgeLevel].cost; // cost to reach next level
}

export function getForgeChances(level = state.forgeLevel) {
    return FORGE_LEVELS[Math.min(level, MAX_FORGE_LEVEL) - 1].chances;
}

export function upgradeForge() {
    const cost = getForgeUpgradeCost();
    if (cost == null || state.gold < cost) return false;
    state.gold -= cost;
    state.forgeLevel += 1;
    state.forgeXp = 0; // buying a level starts the next XP bar fresh
    save();
    gameEvents.emit(EVENTS.FORGE_UPGRADED, state.forgeLevel);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

/** Grant forge XP (from forging). Auto-levels the forge when the bar fills. */
export function grantForgeXp(amount) {
    if (amount <= 0 || state.forgeLevel >= MAX_FORGE_LEVEL) return;
    state.forgeXp += amount;
    let leveled = false;
    while (state.forgeLevel < MAX_FORGE_LEVEL) {
        const need = forgeXpForLevel(state.forgeLevel);
        if (need == null || state.forgeXp < need) break;
        state.forgeXp -= need;
        state.forgeLevel += 1;
        leveled = true;
    }
    if (state.forgeLevel >= MAX_FORGE_LEVEL) state.forgeXp = 0;
    save();
    if (leveled) gameEvents.emit(EVENTS.FORGE_UPGRADED, state.forgeLevel);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return leveled;
}

/** Grant player XP (from defeating enemies). Auto-levels the player. */
export function grantPlayerXp(amount) {
    if (amount <= 0 || state.playerLevel >= MAX_PLAYER_LEVEL) return 0;
    state.playerXp += amount;
    let leveled = false;
    while (state.playerLevel < MAX_PLAYER_LEVEL) {
        const need = playerXpForLevel(state.playerLevel);
        if (state.playerXp < need) break;
        state.playerXp -= need;
        state.playerLevel += 1;
        leveled = true;
    }
    if (state.playerLevel >= MAX_PLAYER_LEVEL) state.playerXp = 0;
    save();
    if (leveled) gameEvents.emit(EVENTS.PLAYER_LEVEL_UP, state.playerLevel);
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return amount;
}

// ── Gold ──────────────────────────────────────────────────────────────────
/** Award gold from a gameplay source, applying clan gold bonus. Returns granted amount. */
export function grantGold(base) {
    const amount = Math.floor(base * (1 + getGoldBonusPct() / 100));
    state.gold += amount;
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return amount;
}

export function spendGold(amount) {
    if (state.gold < amount) return false;
    state.gold -= amount;
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// ── Cosmetics (gold sink — purely visual, never power) ──────────────────────
/**
 * Buy a cosmetic (premium avatar or profile frame) with gold. Gold is
 * client-authoritative — exactly like the forge upgrade above — so we deduct
 * locally and the next debounced save persists both the new balance and the
 * owned item. Returns { ok, error?, cosmetic? }.
 */
export function purchaseCosmetic(id) {
    const cosmetic = getCosmetic(id);
    if (!cosmetic) return { ok: false, error: 'Unknown item' };
    if (ownsCosmetic(id)) return { ok: false, error: 'Already owned' };
    if (state.gold < cosmetic.price) return { ok: false, error: 'Not enough gold' };
    state.gold -= cosmetic.price;
    state.ownedCosmetics.push(id);
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return { ok: true, cosmetic };
}

/** Equip a profile frame the player owns. Returns true if it changed. */
export function setFrame(id) {
    const cosmetic = getCosmetic(id);
    if (!cosmetic || cosmetic.kind !== 'frame') return false;
    if (!ownsCosmetic(id)) return false;
    state.frame = id;
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

/**
 * Add gold that the server already granted out-of-band (e.g. a resolved clan
 * expedition reward). Flat — the server reward is final, so we don't re-apply the
 * clan gold bonus. Mirroring it locally keeps the client's authoritative gold in
 * sync so the next debounced save doesn't overwrite the reward. Returns the amount.
 */
export function creditServerGold(amount) {
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    state.gold += amt;
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return amt;
}

// ── Admin/dev helpers (used by the in-game staff panel) ─────────────────────
/** Grant gold directly, bypassing clan bonus. For admin self-grants only. */
export function addGold(amount) {
    state.gold = Math.max(0, state.gold + Math.floor(amount));
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

/** Reset the local player's progression to a fresh start (admin self-reset). */
export function resetProgress() {
    state.equipment = emptyEquipment();
    state.gold = STARTING_GOLD;
    state.forgeLevel = 1;
    state.forgeXp = 0;
    state.bestLevels = {};
    state.arenaRank = 1;
    state.highestArenaRank = 1;
    state.playerLevel = 1;
    state.playerXp = 0;
    state.avatar = 'wizard';
    state.ownedCosmetics = [];
    state.frame = 'none';
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

// ── Equipment ─────────────────────────────────────────────────────────────
/** Equip an item. Any item it replaces is discarded — gear can't be sold for gold. */
export function equipItem(item) {
    state.equipment[item.type] = item;
    save();
    gameEvents.emit(EVENTS.ITEM_EQUIPPED, item);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

/** Discard an item. Gold can't be recovered from gear — gold is deliberately scarce. */
export function trashItem(item) {
    save();
    gameEvents.emit(EVENTS.ITEM_TRASHED, { item });
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

// ── Arena ─────────────────────────────────────────────────────────────────
export function setArenaRank(rank) {
    state.arenaRank = Math.max(1, rank);
    if (state.arenaRank > state.highestArenaRank) state.highestArenaRank = state.arenaRank;
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

// ── Avatar ────────────────────────────────────────────────────────────────
export function setAvatar(id) {
    if (!ownsCosmetic(id)) return; // can't wear a premium avatar you don't own
    state.avatar = id;
    save();
    gameEvents.emit(EVENTS.STATE_CHANGED);
    if (getAccessToken()) {
        apiFetch('/api/auth/profile-picture', { method: 'PUT', body: { profilePicture: id } }).catch(() => {});
    }
}

// ── Clan perks (set by clan.js) ───────────────────────────────────────────
export function setClanPerks(perks) {
    state.perks = {
        goldBonusPct: perks?.goldBonusPct || 0,
        forgeLuckPct: perks?.forgeLuckPct || 0,
        forgeSpeedPct: perks?.forgeSpeedPct || 0,
        forgeBestOf: Math.max(1, perks?.forgeBestOf || 1),
        statBonusPct: perks?.statBonusPct || 0,
    };
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

// ── Persistence ───────────────────────────────────────────────────────────
function buildSave() {
    return {
        equipment: state.equipment,
        gold: state.gold,
        forgeLevel: state.forgeLevel,
        forgeHighestLevel: state.bestLevels,
        // Stub kept so the server's combat validator accepts the save.
        combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
        player: {
            level: state.playerLevel,
            xp: state.playerXp,
            forgeXp: state.forgeXp,
            profilePicture: state.avatar,
            cosmetics: state.ownedCosmetics,
            frame: state.frame,
            arenaRank: state.arenaRank,
            highestArenaRank: state.highestArenaRank,
        },
    };
}

let saveTimer = null;
let saveInFlight = false;
let dirtyWhileSaving = false;
const SAVE_DEBOUNCE = 1500;

export function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave())); } catch { /* ignore */ }
    if (!getAccessToken()) return;
    if (saveInFlight) { dirtyWhileSaving = true; return; }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToServer, SAVE_DEBOUNCE);
}

async function saveToServer() {
    saveTimer = null;
    saveInFlight = true;
    dirtyWhileSaving = false;
    try {
        await apiFetch('/api/game/state', { method: 'PUT', body: buildSave() });
    } catch (err) {
        console.error('Save failed:', err);
    } finally {
        saveInFlight = false;
        if (dirtyWhileSaving) { dirtyWhileSaving = false; saveTimer = setTimeout(saveToServer, SAVE_DEBOUNCE); }
    }
}

function applyLoaded(data) {
    if (!data || typeof data !== 'object') return;

    EQUIPMENT_TYPES.forEach((type) => {
        const raw = data.equipment?.[type];
        state.equipment[type] = isValidItem(raw) ? normalizeItem(raw) : null;
    });

    if (typeof data.gold === 'number' && data.gold >= 0) state.gold = Math.floor(data.gold);
    if (typeof data.forgeLevel === 'number' && data.forgeLevel >= 1) {
        state.forgeLevel = Math.min(MAX_FORGE_LEVEL, Math.floor(data.forgeLevel));
    }

    if (data.forgeHighestLevel && typeof data.forgeHighestLevel === 'object') {
        state.bestLevels = {};
        EQUIPMENT_TYPES.forEach((type) => {
            const slot = data.forgeHighestLevel[type];
            if (slot && typeof slot === 'object') {
                state.bestLevels[type] = {};
                for (const [tier, lvl] of Object.entries(slot)) {
                    if (typeof lvl === 'number' && lvl >= 1) state.bestLevels[type][tier] = Math.floor(lvl);
                }
            }
        });
    }

    const player = data.player || {};
    if (typeof player.profilePicture === 'string') state.avatar = player.profilePicture;
    if (Array.isArray(player.cosmetics)) {
        state.ownedCosmetics = player.cosmetics.filter((c) => typeof c === 'string');
    }
    if (typeof player.frame === 'string') state.frame = player.frame;
    if (typeof player.level === 'number' && player.level >= 1) {
        state.playerLevel = Math.min(MAX_PLAYER_LEVEL, Math.floor(player.level));
    }
    if (typeof player.xp === 'number' && player.xp >= 0) state.playerXp = Math.floor(player.xp);
    if (typeof player.forgeXp === 'number' && player.forgeXp >= 0) state.forgeXp = Math.floor(player.forgeXp);
    if (typeof player.arenaRank === 'number' && player.arenaRank >= 1) state.arenaRank = Math.floor(player.arenaRank);
    if (typeof player.highestArenaRank === 'number' && player.highestArenaRank >= 1) {
        state.highestArenaRank = Math.floor(player.highestArenaRank);
    }
    if (state.arenaRank > state.highestArenaRank) state.highestArenaRank = state.arenaRank;
}

export function loadLocal() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) applyLoaded(JSON.parse(raw));
    } catch (err) {
        console.error('Local load failed:', err);
    }
    gameEvents.emit(EVENTS.GAME_LOADED);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

export async function loadFromServer() {
    try {
        const res = await apiFetch('/api/game/state');
        if (!res.ok) { loadLocal(); return; }
        applyLoaded(await res.json());
    } catch (err) {
        console.error('Server load failed:', err);
        loadLocal();
        return;
    }
    gameEvents.emit(EVENTS.GAME_LOADED);
    gameEvents.emit(EVENTS.STATE_CHANGED);
}

// Flush pending save on tab hide / unload. Use sendBeacon on unload so the
// browser guarantees delivery even if the tab is closing (async fetch is
// cancelled during beforeunload/pagehide).
if (typeof document !== 'undefined') {
    const flush = (useBeacon = false) => {
        if ((saveTimer || dirtyWhileSaving) && getAccessToken()) {
            if (saveTimer) clearTimeout(saveTimer);
            if (useBeacon && navigator.sendBeacon) {
                const token = getAccessToken();
                const beaconPayload = { ...buildSave(), _token: token };
                const blob = new globalThis.Blob([JSON.stringify(beaconPayload)], { type: 'application/json' });
                navigator.sendBeacon('/api/game/state/beacon', blob);
                saveTimer = null;
                dirtyWhileSaving = false;
            } else {
                saveToServer();
            }
        }
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    window.addEventListener('pagehide', () => flush(true));
}
