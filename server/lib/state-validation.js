// Server-side validation for the player-supplied game state (PUT /api/game/state).
//
// Golden rule: NEVER trust the client. Every field a player can save is checked
// here against the same constants the game runs on (shared/stats.js), so a
// modified client or a hand-crafted request can't smuggle in impossible values
// — over-cap item levels, unknown or out-of-range bonus stats, fabricated raw
// stats, NaN/Infinity gold, mismatched slots, and so on.
//
// Kept free of Prisma/Express imports so it can be unit-tested in isolation.

import {
    EQUIPMENT_TYPES,
    HEALTH_ITEMS,
    MAX_TIER,
    MAX_PLAYER_LEVEL,
    MAX_ITEM_LEVEL,
    BONUS_STATS,
    TIERS,
    calculateItemStats,
} from '../../shared/stats.js';

/** A real, finite number (rejects NaN and ±Infinity, which `typeof` calls 'number'). */
export function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}

/** A finite number that is >= 0 (used for currencies). */
export function isNonNegativeNumber(n) {
    return isFiniteNumber(n) && n >= 0;
}

/** A finite integer within [min, max]. */
export function isIntInRange(n, min, max) {
    return isFiniteNumber(n) && Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Validate an item's bonus list against the tier's allowed bonus count and the
 * per-stat legal range. Rejects unknown stat keys, duplicate stacking, and any
 * value outside [0, BONUS_STATS[key].max].
 */
export function isValidBonuses(bonuses, tier) {
    if (bonuses === undefined) return true;
    if (!Array.isArray(bonuses)) return false;

    const maxCount = TIERS[tier - 1]?.bonusCount ?? 0;
    if (bonuses.length > maxCount) return false;

    const seen = new Set();
    for (const b of bonuses) {
        if (typeof b !== 'object' || b === null) return false;
        const def = BONUS_STATS[b.type];
        if (!def) return false; // unknown bonus stat
        if (seen.has(b.type)) return false; // no duplicate stacking
        seen.add(b.type);
        if (!isFiniteNumber(b.value)) return false;
        if (b.value < 0 || b.value > def.max) return false; // out of legal range
    }
    return true;
}

/**
 * Validate a single equipped item. When `slot` is given (the equipment map key),
 * the item must belong in that slot and its derived fields must be self-consistent
 * — the client cannot equip a weapon in the hat slot or lie about raw stats.
 */
export function isValidItem(item, slot) {
    if (item === null) return true; // empty slot
    if (typeof item !== 'object' || Array.isArray(item)) return false;

    if (!isIntInRange(item.level, 1, MAX_ITEM_LEVEL)) return false;
    if (!isIntInRange(item.tier, 1, MAX_TIER)) return false;
    if (typeof item.type !== 'string' || !EQUIPMENT_TYPES.includes(item.type)) return false;

    // The item must match the slot it is equipped in.
    if (slot !== undefined && item.type !== slot) return false;

    const isHealth = HEALTH_ITEMS.includes(item.type);

    // statType, when present, must match the slot family.
    if (item.statType !== undefined && item.statType !== (isHealth ? 'health' : 'damage')) {
        return false;
    }

    // Raw stats, when present, must equal the canonical value for this level/tier.
    // Clan/PvP power is derived from gear, so a fabricated `stats` is a cheat.
    if (item.stats !== undefined) {
        if (item.stats !== calculateItemStats(item.level, item.tier, isHealth)) return false;
    }

    // attackStyle only exists on weapons and only as melee/ranged.
    if (item.attackStyle !== undefined) {
        if (item.type !== 'weapon' || !['melee', 'ranged'].includes(item.attackStyle)) return false;
    }

    if (!isValidBonuses(item.bonuses, item.tier)) return false;

    return true;
}

export function isValidEquipment(equipment) {
    if (typeof equipment !== 'object' || Array.isArray(equipment) || equipment === null) return false;
    for (const [slot, item] of Object.entries(equipment)) {
        if (!EQUIPMENT_TYPES.includes(slot)) return false;
        if (!isValidItem(item, slot)) return false;
    }
    return true;
}

export function isValidPlayer(player) {
    if (typeof player !== 'object' || Array.isArray(player) || player === null) return false;
    if (!isIntInRange(player.level, 1, MAX_PLAYER_LEVEL)) return false;
    if (!isNonNegativeNumber(player.xp)) return false;
    if (player.forgeXp !== undefined && !isNonNegativeNumber(player.forgeXp)) return false;
    // Cosmetics are purely visual (no power), but still sanity-check the shape so a
    // crafted save can't smuggle in junk: owned list = array of short strings,
    // equipped frame = a string. Catalog/ownership is enforced client-side.
    if (player.cosmetics !== undefined) {
        if (!Array.isArray(player.cosmetics)) return false;
        if (player.cosmetics.length > 100) return false;
        for (const c of player.cosmetics) {
            if (typeof c !== 'string' || c.length === 0 || c.length > 30) return false;
        }
    }
    if (player.frame !== undefined && typeof player.frame !== 'string') return false;
    return true;
}

export function isValidForgeHighestLevel(forgeHighestLevel) {
    if (typeof forgeHighestLevel !== 'object' || Array.isArray(forgeHighestLevel) || forgeHighestLevel === null) {
        return false;
    }
    return true;
}
