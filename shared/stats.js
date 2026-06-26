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

// --- Defensive / finisher stat tuning ---
// Execute grants its bonus damage only once the foe is badly wounded; Damage
// Reduction is hard-capped so stacked mitigation can never reach full immunity.
export const EXECUTE_HP_THRESHOLD = 0.30;       // foe HP fraction below which Execute fires
export const MAX_DAMAGE_REDUCTION = 75;         // hard cap on stacked Damage Reduction (%)

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

// Highest level a single forged item can reach. Lives here (not just in the
// client config) so the server's save validator and the tamper-resistant power
// math below agree with the client on the maximum. The client re-exports this
// from src/game/config.js.
export const MAX_ITEM_LEVEL = 100;

/** Base health for a player at the given level (level 1 = BASE_HEALTH). */
export function playerBaseHealth(level = 1) {
    return BASE_HEALTH + (Math.max(1, level) - 1) * HEALTH_PER_LEVEL;
}

/** Base attack for a player at the given level (level 1 = BASE_DAMAGE). */
export function playerBaseDamage(level = 1) {
    return BASE_DAMAGE + (Math.max(1, level) - 1) * DAMAGE_PER_LEVEL;
}

export const BONUS_STATS = {
    attackSpeed:    { label: 'Attack Speed',    icon: '\u26A1', max: 30, unit: '%' },
    critChance:     { label: 'Crit Chance',     icon: '\uD83C\uDFAF', max: 12, unit: '%' },
    critMultiplier: { label: 'Crit Multiplier', icon: '\uD83D\uDCA5', max: 60, unit: '%' },
    healthMulti:    { label: 'Health Multi',    icon: '\uD83D\uDC97', max: 25, unit: '%' },
    damageMulti:    { label: 'Damage Multi',    icon: '\uD83D\uDDE1\uFE0F', max: 20, unit: '%' },
    healthRegen:    { label: 'Health Regen',    icon: '\uD83E\uDE79', max: 8,  unit: '%' },
    lifeSteal:      { label: 'Life Steal',      icon: '\uD83E\uDDDB', max: 20, unit: '%' },
    doubleHit:      { label: 'Double Hit',      icon: '\uD83D\uDD01', max: 15, unit: '%' },
    // Style-conditional damage: only the bonus matching the equipped weapon's
    // style applies (Melee on melee weapons, Ranged on ranged). Melee is the
    // deliberately-dominant glass-cannon path; Ranged is the safer, weaker option.
    meleeDamage:    { label: 'Melee Damage',    icon: '\u2694\uFE0F', max: 100, unit: '%' },
    rangedDamage:   { label: 'Ranged Damage',   icon: '\uD83C\uDFF9', max: 25, unit: '%' },
    // Defensive / finisher stats (resolved in the combat engine, not the flat pools).
    damageReduction:{ label: 'Damage Reduction',icon: '\uD83D\uDEE1\uFE0F', max: 8,  unit: '%' },
    reflect:        { label: 'Reflect',         icon: '\uD83E\uDE9E', max: 12, unit: '%' },
    execute:        { label: 'Execute',         icon: '\uD83E\uDE93', max: 30, unit: '%' },
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
export function calculatePowerScore(totalHealth, totalDamage, bonuses, style = 'melee') {
    const b = bonuses || {};
    // Only the style-matched conditional damage bonus counts toward power.
    const styleDmg = style === 'ranged' ? (b.rangedDamage || 0) : (b.meleeDamage || 0);
    const effectiveHealth = totalHealth
        * (1 + (b.healthMulti || 0) / 100)
        * (1 + ((b.healthRegen || 0) + (b.lifeSteal || 0)) / 100)
        * (1 + (b.damageReduction || 0) / 100); // mitigation ≈ effective-HP gain
    const effectiveDamage = totalDamage
        * (1 + ((b.damageMulti || 0) + styleDmg) / 100)
        * (1 + (b.attackSpeed || 0) / 100)
        * (1 + (b.doubleHit || 0) / 100)
        * (1 + (b.reflect || 0) / 100 * 0.5)   // situational: half-weighted
        * (1 + (b.execute || 0) / 100 * 0.3)   // only fires on wounded foes: light weight
        * (1 + (b.critChance || 0) / 100 * (b.critMultiplier || 0) / 100);
    return Math.round(effectiveHealth + effectiveDamage);
}

export function computeStatsFromEquipment(equipment, playerLevel = 1, statBonusPct = 0) {
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

    // Only the conditional damage bonus matching the equipped weapon's style
    // applies, stacking additively with Damage Multi on the gear damage pool.
    const style = weaponStyle(equipment.weapon);
    const styleDmgPct = style === 'ranged' ? (bonuses.rangedDamage || 0) : (bonuses.meleeDamage || 0);

    // Clan stat perk scales the final HP & damage (applies in PvE and PvP).
    const clanMult = 1 + Math.max(0, statBonusPct) / 100;
    const maxHP = Math.floor((playerBaseHealth(playerLevel) + Math.floor(totalHealth * (1 + (bonuses.healthMulti || 0) / 100))) * clanMult);
    const damage = Math.floor((playerBaseDamage(playerLevel) + Math.floor(totalDamage * (1 + ((bonuses.damageMulti || 0) + styleDmgPct) / 100))) * clanMult);

    return {
        maxHP,
        damage,
        critChance: bonuses.critChance || 0,
        critMultiplier: bonuses.critMultiplier || 0,
        healthRegen: bonuses.healthRegen || 0,
        lifeSteal: bonuses.lifeSteal || 0,
        attackSpeed: bonuses.attackSpeed || 0,
        doubleHit: bonuses.doubleHit || 0,
        damageReduction: bonuses.damageReduction || 0,
        reflect: bonuses.reflect || 0,
        execute: bonuses.execute || 0,
        // Combat style comes from the equipped weapon (melee by default).
        ranged: style === 'ranged',
    };
}

/**
 * Total power score from gear + player level base stats. Used by the UI power
 * display and by server PvP matchmaking/ELO so player level counts everywhere.
 */
export function playerPowerScore(equipment, playerLevel = 1, statBonusPct = 0) {
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
    const gearPower = calculatePowerScore(totalHealth, totalDamage, bonuses, weaponStyle(equipment.weapon));
    const base = gearPower + playerBaseHealth(playerLevel) + playerBaseDamage(playerLevel);
    return Math.round(base * (1 + Math.max(0, statBonusPct) / 100));
}

/**
 * Itemized power breakdown for the UI's "how is my Power calculated" page.
 *
 * Recomputes the exact same numbers as `playerPowerScore` but keeps every
 * intermediate value so the screen can show a per-stat table and the formula
 * steps. By construction `powerBreakdown(...).total === playerPowerScore(...)`
 * for the same arguments (asserted in tests).
 */
export function powerBreakdown(equipment, playerLevel = 1, statBonusPct = 0) {
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
    const b = bonuses || {};

    const baseHealth = playerBaseHealth(playerLevel);
    const baseDamage = playerBaseDamage(playerLevel);

    // Gear pools multiplied by their relevant bonus stats (mirrors calculatePowerScore).
    const styleDmg = weaponStyle(equipment.weapon) === 'ranged' ? (b.rangedDamage || 0) : (b.meleeDamage || 0);
    const healthMult = (1 + (b.healthMulti || 0) / 100)
        * (1 + ((b.healthRegen || 0) + (b.lifeSteal || 0)) / 100)
        * (1 + (b.damageReduction || 0) / 100);
    const damageMult = (1 + ((b.damageMulti || 0) + styleDmg) / 100)
        * (1 + (b.attackSpeed || 0) / 100)
        * (1 + (b.doubleHit || 0) / 100)
        * (1 + (b.reflect || 0) / 100 * 0.5)
        * (1 + (b.execute || 0) / 100 * 0.3)
        * (1 + (b.critChance || 0) / 100 * (b.critMultiplier || 0) / 100);
    const effectiveHealth = totalHealth * healthMult;
    const effectiveDamage = totalDamage * damageMult;

    const gearPower = Math.round(effectiveHealth + effectiveDamage);
    const subtotal = gearPower + baseHealth + baseDamage;
    const pct = Math.max(0, statBonusPct);
    const clanMult = 1 + pct / 100;
    const total = Math.round(subtotal * clanMult);

    // Per-stat rows: flat HP/Damage (base from level + gear), then % bonuses (gear only).
    const rows = [
        { key: 'health', label: 'Health', icon: '❤️', unit: '', base: baseHealth, gear: totalHealth },
        { key: 'damage', label: 'Damage', icon: '⚔️', unit: '', base: baseDamage, gear: totalDamage },
        ...BONUS_STAT_KEYS.map((key) => ({
            key,
            label: BONUS_STATS[key].label,
            icon: BONUS_STATS[key].icon,
            unit: BONUS_STATS[key].unit,
            base: 0,
            gear: b[key] || 0,
        })),
    ].map((r) => ({ ...r, total: r.base + r.gear }));

    return {
        playerLevel: Math.max(1, playerLevel),
        statBonusPct: pct,
        clanMult,
        baseHealth, baseDamage,
        gearHealth: totalHealth, gearDamage: totalDamage,
        healthMult, damageMult,
        effectiveHealth, effectiveDamage,
        bonuses: b,
        gearPower, subtotal, total,
        rows,
    };
}

/** Clamp a value to an integer within [min, max], treating junk as min. */
function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/**
 * Tamper-resistant gear power. Unlike `calculateStats`, this recomputes every
 * item's raw stat from its slot, level and tier (ignoring any client-supplied
 * `stats`/`statType`) and only counts *known* bonus stats, each clamped to its
 * legal max. The server uses this so a modified client can't inflate clan/PvP
 * power by saving lies in the `stats` field or out-of-range bonus values.
 */
export function gearPowerFromEquipment(equipment) {
    let totalHealth = 0;
    let totalDamage = 0;
    const bonuses = {};

    if (equipment && typeof equipment === 'object' && !Array.isArray(equipment)) {
        for (const [slot, item] of Object.entries(equipment)) {
            if (!item || typeof item !== 'object' || !EQUIPMENT_TYPES.includes(slot)) continue;
            const tier = clampInt(item.tier, 1, MAX_TIER);
            const level = clampInt(item.level, 1, MAX_ITEM_LEVEL);
            const isHealth = HEALTH_ITEMS.includes(slot);
            const stat = calculateItemStats(level, tier, isHealth);
            if (isHealth) totalHealth += stat;
            else totalDamage += stat;

            if (Array.isArray(item.bonuses)) {
                for (const b of item.bonuses) {
                    if (!b || !BONUS_STATS[b.type]) continue; // unknown stat → ignored
                    const max = BONUS_STATS[b.type].max;
                    const value = Math.max(0, Math.min(max, Number(b.value) || 0));
                    bonuses[b.type] = (bonuses[b.type] || 0) + value;
                }
            }
        }
    }

    const style = equipment && typeof equipment === 'object' ? weaponStyle(equipment.weapon) : 'melee';
    return calculatePowerScore(totalHealth, totalDamage, bonuses, style);
}
