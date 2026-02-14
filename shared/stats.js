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

export const TIERS = [
    { id: 1, name: 'Common',    color: '#9d9d9d', bonusCount: 0 },
    { id: 2, name: 'Uncommon',  color: '#4F772D', bonusCount: 1 },
    { id: 3, name: 'Rare',      color: '#4A7FB5', bonusCount: 1 },
    { id: 4, name: 'Epic',      color: '#7B5EA7', bonusCount: 1 },
    { id: 5, name: 'Legendary', color: '#C4822B', bonusCount: 2 },
    { id: 6, name: 'Mythic',    color: '#A63D3D', bonusCount: 2 },
    { id: 7, name: 'Divine',    color: '#C9A84C', bonusCount: 3 },
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

export function computeStatsFromEquipment(equipment) {
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

    const maxHP = BASE_HEALTH + Math.floor(totalHealth * (1 + (bonuses.healthMulti || 0) / 100));
    const damage = BASE_DAMAGE + Math.floor(totalDamage * (1 + (bonuses.damageMulti || 0) / 100));

    return {
        maxHP,
        damage,
        critChance: bonuses.critChance || 0,
        critMultiplier: bonuses.critMultiplier || 0,
        healthRegen: bonuses.healthRegen || 0,
        lifeSteal: bonuses.lifeSteal || 0,
        attackSpeed: bonuses.attackSpeed || 0,
    };
}
