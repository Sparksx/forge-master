// Auto-forge policy — decides what the idle forge does with each rolled item.
//
// The cardinal rule: auto-forge NEVER equips over your gear. Equipping changes
// your power, and changing your power is always *your* decision. So this only
// ever returns 'trash' (drop a clearly-unwanted roll) or 'present' (show it and
// let you choose) — it never auto-equips. Same-rarity rolls are presented
// whether or not they raise power, so your power can never climb on its own.
//
// Players can tune the policy with two filters (persisted locally):
//   • keepSlots[type]   — "I'm happy with this slot, stop bothering me": every
//                          new roll for it is trashed automatically.
//   • trashLowerPower   — also auto-trash same/higher-rarity rolls that aren't
//                          actually a power gain (instead of presenting them).
import { EQUIPMENT_TYPES } from './config.js';

const SETTINGS_KEY = 'gm.autoForge.settings';

const settings = {
    trashLowerPower: false,
    keepSlots: {}, // { [type]: true }
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

export function setTrashLowerPower(on) {
    settings.trashLowerPower = !!on;
    saveAutoForgeSettings();
}

export function loadAutoForgeSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        settings.trashLowerPower = !!parsed.trashLowerPower;
        settings.keepSlots = {};
        if (parsed.keepSlots && typeof parsed.keepSlots === 'object') {
            EQUIPMENT_TYPES.forEach((t) => { if (parsed.keepSlots[t]) settings.keepSlots[t] = true; });
        }
    } catch { /* ignore corrupt prefs */ }
}

export function saveAutoForgeSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

/**
 * Decide auto-forge's action for a freshly rolled `item`, given the currently
 * `equipped` item in that slot (or null) and the item's power `delta`. Returns
 * `'trash'` or `'present'` — never `'equip'`.
 *
 * - A slot marked "keep" → trash (don't touch my gear there).
 * - An empty slot → present (filling it changes your power, so it's your call).
 * - Strictly lower rarity than equipped → trash.
 * - Same or higher rarity → present, UNLESS trashLowerPower is on and the roll
 *   isn't a power gain (delta <= 0) → trash.
 */
export function autoForgeAction(item, equipped, delta, opts = settings) {
    if (opts.keepSlots && opts.keepSlots[item.type]) return 'trash';
    if (!equipped) return 'present';
    if (item.tier < equipped.tier) return 'trash';
    if (opts.trashLowerPower && delta <= 0) return 'trash';
    return 'present';
}
