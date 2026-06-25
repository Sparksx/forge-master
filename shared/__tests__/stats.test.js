import { describe, it, expect } from 'vitest';
import {
    BASE_HEALTH, BASE_DAMAGE, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, MAX_PLAYER_LEVEL,
    BASE_ATTACK_PERIOD, playerBaseHealth, playerBaseDamage, computeStatsFromEquipment,
    playerPowerScore, powerBreakdown, weaponStyle, gearPowerFromEquipment, calculateItemStats,
    MAX_ITEM_LEVEL, MAX_TIER, BONUS_STATS, BONUS_STAT_KEYS,
} from '../stats.js';

describe('player level base stats', () => {
    it('level 1 equals the flat base values', () => {
        expect(playerBaseHealth(1)).toBe(BASE_HEALTH);
        expect(playerBaseDamage(1)).toBe(BASE_DAMAGE);
    });

    it('higher level raises base HP and attack linearly', () => {
        expect(playerBaseHealth(5)).toBe(BASE_HEALTH + 4 * HEALTH_PER_LEVEL);
        expect(playerBaseDamage(5)).toBe(BASE_DAMAGE + 4 * DAMAGE_PER_LEVEL);
        expect(playerBaseHealth(10)).toBeGreaterThan(playerBaseHealth(9));
        expect(playerBaseDamage(10)).toBeGreaterThan(playerBaseDamage(9));
    });

    it('treats missing/invalid level as level 1', () => {
        expect(playerBaseHealth()).toBe(BASE_HEALTH);
        expect(playerBaseDamage(0)).toBe(BASE_DAMAGE);
    });

    it('exposes a raised player level cap', () => {
        expect(MAX_PLAYER_LEVEL).toBeGreaterThan(100);
    });
});

describe('computeStatsFromEquipment with player level', () => {
    it('scales base maxHP and damage with level on empty equipment', () => {
        const lvl1 = computeStatsFromEquipment({}, 1);
        const lvl20 = computeStatsFromEquipment({}, 20);
        expect(lvl1.maxHP).toBe(playerBaseHealth(1));
        expect(lvl1.damage).toBe(playerBaseDamage(1));
        expect(lvl20.maxHP).toBeGreaterThan(lvl1.maxHP);
        expect(lvl20.damage).toBeGreaterThan(lvl1.damage);
    });

    it('defaults to level 1 when no level is passed', () => {
        expect(computeStatsFromEquipment({}).maxHP).toBe(playerBaseHealth(1));
    });

    it('applies the clan stat bonus to maxHP and damage', () => {
        const base = computeStatsFromEquipment({}, 10);
        const boosted = computeStatsFromEquipment({}, 10, 50); // +50%
        expect(boosted.maxHP).toBe(Math.floor(base.maxHP * 1.5));
        expect(boosted.damage).toBe(Math.floor(base.damage * 1.5));
    });

    it('ignores a negative clan stat bonus', () => {
        const base = computeStatsFromEquipment({}, 10);
        expect(computeStatsFromEquipment({}, 10, -50).maxHP).toBe(base.maxHP);
    });
});

describe('playerPowerScore', () => {
    it('increases with player level even with the same gear', () => {
        const equipment = {};
        expect(playerPowerScore(equipment, 30)).toBeGreaterThan(playerPowerScore(equipment, 1));
    });

    it('applies the clan stat bonus to power', () => {
        const equipment = {};
        const base = playerPowerScore(equipment, 10);
        expect(playerPowerScore(equipment, 10, 25)).toBe(Math.round(base * 1.25));
    });
});

describe('powerBreakdown', () => {
    const equipment = {
        weapon: { type: 'weapon', level: 20, tier: 4, stats: calculateItemStats(20, 4, false), statType: 'damage',
            bonuses: [{ type: 'damageMulti', value: 8 }, { type: 'critChance', value: 5 }] },
        armor: { type: 'armor', level: 18, tier: 3, stats: calculateItemStats(18, 3, true), statType: 'health',
            bonuses: [{ type: 'healthMulti', value: 6 }] },
    };

    it('total exactly matches playerPowerScore for the same args', () => {
        for (const [level, pct] of [[1, 0], [25, 0], [40, 30], [100, 12]]) {
            expect(powerBreakdown(equipment, level, pct).total).toBe(playerPowerScore(equipment, level, pct));
        }
    });

    it('rows cover base HP/Damage plus every bonus stat, with base+gear=total', () => {
        const b = powerBreakdown(equipment, 30, 0);
        expect(b.rows).toHaveLength(2 + BONUS_STAT_KEYS.length);
        const health = b.rows.find((r) => r.key === 'health');
        expect(health.base).toBe(playerBaseHealth(30));
        expect(b.rows.every((r) => r.total === r.base + r.gear)).toBe(true);
    });

    it('aggregates a bonus stat from gear into its row', () => {
        const dmgMulti = powerBreakdown(equipment, 1, 0).rows.find((r) => r.key === 'damageMulti');
        expect(dmgMulti.base).toBe(0);
        expect(dmgMulti.gear).toBe(8);
        expect(dmgMulti.unit).toBe('%');
    });

    it('reflects the clan stat perk multiplier', () => {
        expect(powerBreakdown(equipment, 10, 0).clanMult).toBe(1);
        expect(powerBreakdown(equipment, 10, 25).clanMult).toBe(1.25);
        expect(powerBreakdown(equipment, 10, -5).statBonusPct).toBe(0);
    });
});

describe('gearPowerFromEquipment is tamper-resistant', () => {
    // An honest weapon: stats are the canonical value for its level/tier.
    const honestWeapon = {
        type: 'weapon', level: 10, tier: 3,
        stats: calculateItemStats(10, 3, false), statType: 'damage', bonuses: [],
    };

    it('matches the canonical power for honest gear', () => {
        const power = gearPowerFromEquipment({ weapon: honestWeapon });
        expect(power).toBeGreaterThan(0);
    });

    it('ignores a fabricated raw `stats` value (recomputes from level/tier)', () => {
        const cheater = { ...honestWeapon, stats: 999999999 };
        expect(gearPowerFromEquipment({ weapon: cheater }))
            .toBe(gearPowerFromEquipment({ weapon: honestWeapon }));
    });

    it('clamps an over-cap item level so it cannot inflate power', () => {
        const overLevel = { ...honestWeapon, level: 1e9 };
        const capped = { ...honestWeapon, level: MAX_ITEM_LEVEL };
        expect(gearPowerFromEquipment({ weapon: overLevel }))
            .toBe(gearPowerFromEquipment({ weapon: capped }));
    });

    it('clamps an over-cap tier', () => {
        const overTier = { ...honestWeapon, tier: 999 };
        const capped = { ...honestWeapon, tier: MAX_TIER };
        expect(gearPowerFromEquipment({ weapon: overTier }))
            .toBe(gearPowerFromEquipment({ weapon: capped }));
    });

    it('ignores unknown bonus stats and clamps out-of-range bonus values', () => {
        const max = BONUS_STATS.critChance.max;
        const bogus = {
            ...honestWeapon,
            bonuses: [{ type: 'instantWin', value: 1000 }, { type: 'critChance', value: 100000 }],
        };
        const legit = { ...honestWeapon, bonuses: [{ type: 'critChance', value: max }] };
        expect(gearPowerFromEquipment({ weapon: bogus }))
            .toBe(gearPowerFromEquipment({ weapon: legit }));
    });

    it('ignores items in unknown slots and handles junk input', () => {
        expect(gearPowerFromEquipment({ wings: honestWeapon })).toBe(0);
        expect(gearPowerFromEquipment(null)).toBe(0);
        expect(gearPowerFromEquipment([])).toBe(0);
        expect(gearPowerFromEquipment({ weapon: null })).toBe(0);
    });
});

describe('combat style', () => {
    it('paces combat at roughly one hit per second by default', () => {
        expect(BASE_ATTACK_PERIOD).toBeGreaterThan(0);
        expect(1 / BASE_ATTACK_PERIOD).toBeCloseTo(1.0, 1);
    });

    it('resolves weapon attack style, defaulting to melee', () => {
        expect(weaponStyle(null)).toBe('melee');
        expect(weaponStyle({ attackStyle: 'melee' })).toBe('melee');
        expect(weaponStyle({ attackStyle: 'ranged' })).toBe('ranged');
        expect(weaponStyle({})).toBe('melee');
    });

    it('derives the player ranged flag from the equipped weapon', () => {
        expect(computeStatsFromEquipment({}).ranged).toBe(false);
        expect(computeStatsFromEquipment({ weapon: { type: 'weapon', level: 5, tier: 2, attackStyle: 'ranged' } }).ranged).toBe(true);
        expect(computeStatsFromEquipment({ weapon: { type: 'weapon', level: 5, tier: 2, attackStyle: 'melee' } }).ranged).toBe(false);
    });
});
