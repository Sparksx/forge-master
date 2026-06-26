// Auto-forge policy — decides what the idle forge does with each rolled item.
//
// The cardinal rule: auto-forge NEVER equips over your gear. Equipping changes
// your power, and changing your power is always *your* decision. So this only
// ever returns 'trash' (drop a clearly-unwanted roll) or 'present' (show it and
// let you choose) — it never auto-equips. Same-rarity rolls are presented
// whether or not they raise power, so your power can never climb on its own.
//
// Players can tune the policy with two filters (persisted locally):
//   • keepSlots[type]    — "I'm done with this slot, stop bothering me": every
//                          new roll for it is trashed automatically.
//   • trashRarities[tier] — "I don't care about this rarity any more": every new
//                          roll of that rarity is trashed automatically.
import { EQUIPMENT_TYPES } from './config.js';
import { MAX_TIER } from '../../shared/stats.js';

const SETTINGS_KEY = 'gm.autoForge.settings';

const settings = {
    keepSlots: {}, // { [type]: true }
    trashRarities: {}, // { [tier]: true }
};

export function getAutoForgeSettings() {
    return settings;
}

export function isSlotKept(type) {
    return !!settings.keepSlots[type];
}

export function setSlotKept(type, kept) {
    if (kept) settings.keepSlots[type] = true;
    else delete settings.keepSlots[type];
    saveAutoForgeSettings();
}

export function isRarityTrashed(tier) {
    return !!settings.trashRarities[tier];
}

export function setRarityTrashed(tier, trashed) {
    if (trashed) settings.trashRarities[tier] = true;
    else delete settings.trashRarities[tier];
    saveAutoForgeSettings();
}

export function loadAutoForgeSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        settings.keepSlots = {};
        if (parsed.keepSlots && typeof parsed.keepSlots === 'object') {
            EQUIPMENT_TYPES.forEach((t) => { if (parsed.keepSlots[t]) settings.keepSlots[t] = true; });
        }
        settings.trashRarities = {};
        if (parsed.trashRarities && typeof parsed.trashRarities === 'object') {
            for (let tier = 1; tier <= MAX_TIER; tier += 1) {
                if (parsed.trashRarities[tier]) settings.trashRarities[tier] = true;
            }
        }
    } catch { /* ignore corrupt prefs */ }
}

export function saveAutoForgeSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

/**
 * Decide auto-forge's action for a freshly rolled `item`, given the currently
 * `equipped` item in that slot (or null). Returns `'trash'` or `'present'` —
 * never `'equip'`.
 *
 * - A slot marked "keep" → trash (don't bother me about this slot any more).
 * - A rarity marked "trash" → trash (I don't want this tier any more).
 * - An empty slot → present (filling it changes your power, so it's your call).
 * - Strictly lower rarity than equipped → trash.
 * - Same or higher rarity → present (so power only changes when you choose).
 */
export function autoForgeAction(item, equipped, opts = settings) {
    if (opts.keepSlots && opts.keepSlots[item.type]) return 'trash';
    if (opts.trashRarities && opts.trashRarities[item.tier]) return 'trash';
    if (!equipped) return 'present';
    if (item.tier < equipped.tier) return 'trash';
    return 'present';
}
