// Shared constants and stat computation used by both client and server.
// This avoids duplicating game-balance values in multiple places.

export const EQUIPMENT_TYPES = ['hat', 'armor', 'belt', 'boots', 'gloves', 'necklace', 'ring', 'weapon'];
export const HEALTH_ITEMS = ['hat', 'armor', 'belt', 'boots'];
export const DAMAGE_ITEMS = ['gloves', 'necklace', 'ring', 'weapon'];

export const BASE_HEALTH = 100;
export const BASE_DAMAGE = 10;
export const HEALTH_PER_LEVEL = 10;
export const DAMAGE_PER_LEVEL = 2;
export const GROWTH_EXPONENT = 1.2;

// --- Combat cadence & range ---
// Fights are paced so every combatant lands roughly one hit every second
// (1 hit/sec) at zero Attack Speed. Attack Speed shortens the interval.
export const BASE_ATTACK_PERIOD = 1.0;          // seconds between attacks at 0% AS
export const MAX_BATTLE_SECONDS = 22;           // hard cap; resolve by HP% past this

// Weapons (and enemies) are either melee or ranged. Everyone fires the instant
// they acquire focus — there is no opening wait — but ranged acquire it sooner
// because they strike from a standoff while melee still have to close the gap.
// In the abstract model this is a small approach delay on the melee opener.
export const ATTACK_STYLES = ['melee', 'ranged'];
export const RANGED_OPENING_FRACTION = 0.35;    // melee approach delay (ranged open at t=0)

/** Resolve a weapon's attack style, defaulting to melee. */
export function weaponStyle(weapon) {
    return weapon && weapon.attackStyle === 'ranged' ? 'ranged' : 'melee';
}

// Player level: gained by defeating arena enemies. Only the base HP and base
// attack grow with level — every other base stat is fixed. The forge level is a
// separate track (see config.js) and is unaffected by player level.
export const MAX_PLAYER_LEVEL = 500;

// Forge level cap. Lives here (not just in the client config) so the server's
// save validator and admin tools agree with the client on the maximum. The
// client's FORGE_LEVELS design table (src/game/config.js) must have exactly this
// many entries — a test asserts it. Bump both together (re-run the generator).
export const MAX_FORGE_LEVEL = 35;

/** Base health for a player at the given level (level 1 = BASE_HEALTH). */
export function playerBaseHealth(level = 1) {
    return BASE_HEALTH + (Math.max(1, level) - 1) * HEALTH_PER_LEVEL;
}

/** Base attack for a player at the given level (level 1 = BASE_DAMAGE). */
export function playerBaseDamage(level = 1) {
    return BASE_DAMAGE + (Math.max(1, level) - 1) * DAMAGE_PER_LEVEL;
}

export const BONUS_STATS = {
    attackSpeed:    { label: 'Attack Speed',    icon: '\u26A1', max: 15, unit: '%' },
    critChance:     { label: 'Crit Chance',     icon: '\uD83C\uDFAF', max: 10, unit: '%' },
    critMultiplier: { label: 'Crit Multiplier', icon: '\uD83D\uDCA5', max: 20, unit: '%' },
    healthMulti:    { label: 'Health Multi',    icon: '\uD83D\uDC97', max: 12, unit: '%' },
    damageMulti:    { label: 'Damage Multi',    icon: '\uD83D\uDDE1\uFE0F', max: 12, unit: '%' },
    healthRegen:    { label: 'Health Regen',    icon: '\uD83E\uDE79', max: 5,  unit: '%' },
    lifeSteal:      { label: 'Life Steal',      icon: '\uD83E\uDDDB', max: 8,  unit: '%' },
};

export const BONUS_STAT_KEYS = Object.keys(BONUS_STATS);

// --- Tier system ---

// Vivid, high-saturation rarity colours. Hues are spread so that no two
// contiguous tiers sit close on the colour wheel, and none are pastel — each
// gear card gets a solid, easily distinguishable background.
export const TIERS = [
    { id: 1, name: 'Common',    color: '#9aa6b8', bonusCount: 0 }, // steel gray
    { id: 2, name: 'Uncommon',  color: '#2ecc40', bonusCount: 1 }, // green
    { id: 3, name: 'Rare',      color: '#1f9bff', bonusCount: 1 }, // azure blue
    { id: 4, name: 'Epic',      color: '#b14dff', bonusCount: 1 }, // violet
    { id: 5, name: 'Legendary', color: '#ff8c1a', bonusCount: 2 }, // orange
    { id: 6, name: 'Mythic',    color: '#ff2d68', bonusCount: 2 }, // crimson rose
    { id: 7, name: 'Divine',    color: '#ffd11a', bonusCount: 3 }, // gold
];

export const MAX_TIER = TIERS.length;

/**
 * Compute the raw stat value for an item given its level, tier, and type.
 */
export function calculateItemStats(level, tier, isHealthItem) {
    const effectiveLevel = (tier - 1) * 100 + level;
    const perLevel = isHealthItem ? HEALTH_PER_LEVEL : DAMAGE_PER_LEVEL;
    return Math.floor(perLevel * Math.pow(effectiveLevel, GROWTH_EXPONENT));
}

/**
 * Sum up total health, damage, and bonuses from an equipment map.
 */
export function calculateStats(equipment) {
    let totalHealth = 0;
    let totalDamage = 0;
    const bonuses = {};

    BONUS_STAT_KEYS.forEach(key => { bonuses[key] = 0; });

    Object.values(equipment).forEach(item => {
        if (!item) return;
        if (item.statType === 'health') {
            totalHealth += item.stats;
        } else {
            totalDamage += item.stats;
        }
        if (item.bonuses && Array.isArray(item.bonuses)) {
            item.bonuses.forEach(bonus => {
                if (bonus.type && bonus.value) {
                    bonuses[bonus.type] = (bonuses[bonus.type] || 0) + bonus.value;
                }
            });
        }
    });

    return { totalHealth, totalDamage, bonuses };
}

/**
 * Compute effective combat stats from an equipment map.
 * Used by both client combat and server PvP to derive maxHP, damage, etc.
 */
/**
 * Calculate a composite power score from total health, damage and bonuses.
 * Used by client UI and server matchmaking / ELO.
 */
export function calculatePowerScore(totalHealth, totalDamage, bonuses) {
    const b = bonuses || {};
    const effectiveHealth = totalHealth
        * (1 + (b.healthMulti || 0) / 100)
        * (1 + ((b.healthRegen || 0) + (b.lifeSteal || 0)) / 100);
    const effectiveDamage = totalDamage
        * (1 + (b.damageMulti || 0) / 100)
        * (1 + (b.attackSpeed || 0) / 100)
        * (1 + (b.critChance || 0) / 100 * (b.critMultiplier || 0) / 100);
    return Math.round(effectiveHealth + effectiveDamage);
}

export function computeStatsFromEquipment(equipment, playerLevel = 1) {
    let totalHealth = 0;
    let totalDamage = 0;
    const bonuses = {};

    for (const [slot, item] of Object.entries(equipment)) {
        if (!item) continue;
        const tier = item.tier || 1;
        const level = item.level || 1;
        const isHealth = HEALTH_ITEMS.includes(slot);
        const stats = calculateItemStats(level, tier, isHealth);

        if (isHealth) totalHealth += stats;
        else totalDamage += stats;

        if (item.bonuses && Array.isArray(item.bonuses)) {
            for (const b of item.bonuses) {
                if (b.type && typeof b.value === 'number') {
                    bonuses[b.type] = (bonuses[b.type] || 0) + b.value;
                }
            }
        }
    }

    const maxHP = playerBaseHealth(playerLevel) + Math.floor(totalHealth * (1 + (bonuses.healthMulti || 0) / 100));
    const damage = playerBaseDamage(playerLevel) + Math.floor(totalDamage * (1 + (bonuses.damageMulti || 0) / 100));

    return {
        maxHP,
        damage,
        critChance: bonuses.critChance || 0,
        critMultiplier: bonuses.critMultiplier || 0,
        healthRegen: bonuses.healthRegen || 0,
        lifeSteal: bonuses.lifeSteal || 0,
        attackSpeed: bonuses.attackSpeed || 0,
        // Combat style comes from the equipped weapon (melee by default).
        ranged: weaponStyle(equipment.weapon) === 'ranged',
    };
}

/**
 * Total power score from gear + player level base stats. Used by the UI power
 * display and by server PvP matchmaking/ELO so player level counts everywhere.
 */
export function playerPowerScore(equipment, playerLevel = 1) {
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
    const gearPower = calculatePowerScore(totalHealth, totalDamage, bonuses);
    return gearPower + playerBaseHealth(playerLevel) + playerBaseDamage(playerLevel);
}
