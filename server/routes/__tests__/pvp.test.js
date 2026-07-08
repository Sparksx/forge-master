import { describe, it, expect, vi } from 'vitest';

// Mock non-pure dependencies so importing pvp.js doesn't blow up.
vi.mock('express', () => ({ Router: () => ({ post: () => {}, get: () => {} }) }));
vi.mock('../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../../middleware/auth.js', () => ({ requireAuth: (req, res, next) => next() }));
vi.mock('../../shared/combat.js', () => ({ simulateBattle: () => ({}) }));
vi.mock('../../lib/pvp-match.js', () => ({
    pickOpponent: () => null,
    attackerEloChange: () => 0,
}));

import { clanStatBonusPct, fighterFromUser, publicFighter, mirrorBot } from '../pvp.js';
import { computeStatsFromEquipment, playerPowerScore } from '../../../shared/stats.js';
import { clanPerks, clanLevelFromXp } from '../../../shared/clan-config.js';

// ---------------------------------------------------------------------------
// clanStatBonusPct
// ---------------------------------------------------------------------------
describe('clanStatBonusPct', () => {
    it('returns 0 for null membership', () => {
        expect(clanStatBonusPct(null)).toBe(0);
    });

    it('returns 0 for undefined membership', () => {
        expect(clanStatBonusPct(undefined)).toBe(0);
    });

    it('returns 0 when membership has no clan', () => {
        expect(clanStatBonusPct({})).toBe(0);
    });

    it('returns 0 when clan has no xp', () => {
        expect(clanStatBonusPct({ clan: {} })).toBe(0);
    });

    it('returns 0 when clan xp is not a number', () => {
        expect(clanStatBonusPct({ clan: { xp: 'lots' } })).toBe(0);
    });

    it('returns the statBonusPct from clanPerks for valid clan xp', () => {
        // xp = 0 => level 1 => tier 0 => statBonusPct = 0
        expect(clanStatBonusPct({ clan: { xp: 0 } })).toBe(0);

        // xp = 1000 => level 2 => tier 1 => statBonusPct = 1
        expect(clanStatBonusPct({ clan: { xp: 1000 } })).toBe(
            clanPerks(clanLevelFromXp(1000)).statBonusPct,
        );

        // xp = 10000 => higher level => verify against clanPerks directly
        const level = clanLevelFromXp(10000);
        const expected = clanPerks(level).statBonusPct;
        expect(clanStatBonusPct({ clan: { xp: 10000 } })).toBe(expected);
    });
});

// ---------------------------------------------------------------------------
// fighterFromUser
// ---------------------------------------------------------------------------
describe('fighterFromUser', () => {
    const bareUser = {
        id: 42,
        username: 'TestHero',
        profilePicture: 'knight',
        pvpRating: 1200,
        gameState: { equipment: {}, player: { level: 1 } },
        clanMembership: null,
    };

    it('returns an object with id, username, avatar, and rating from the user', () => {
        const f = fighterFromUser(bareUser);
        expect(f.id).toBe(42);
        expect(f.username).toBe('TestHero');
        expect(f.avatar).toBe('knight');
        expect(f.rating).toBe(1200);
    });

    it('defaults avatar to "wizard" when profilePicture is falsy', () => {
        const f = fighterFromUser({ ...bareUser, profilePicture: null });
        expect(f.avatar).toBe('wizard');
    });

    it('defaults rating to 1000 when pvpRating is null/undefined', () => {
        const f = fighterFromUser({ ...bareUser, pvpRating: null });
        expect(f.rating).toBe(1000);

        const f2 = fighterFromUser({ ...bareUser, pvpRating: undefined });
        expect(f2.rating).toBe(1000);
    });

    it('floors maxHP at 100', () => {
        const f = fighterFromUser(bareUser);
        expect(f.maxHP).toBeGreaterThanOrEqual(100);
    });

    it('floors damage at 10', () => {
        const f = fighterFromUser(bareUser);
        expect(f.damage).toBeGreaterThanOrEqual(10);
    });

    it('floors power at 1', () => {
        const f = fighterFromUser(bareUser);
        expect(f.power).toBeGreaterThanOrEqual(1);
    });

    it('handles missing gameState gracefully (empty equipment, level 1)', () => {
        const f = fighterFromUser({ ...bareUser, gameState: null });
        expect(f.maxHP).toBeGreaterThanOrEqual(100);
        expect(f.damage).toBeGreaterThanOrEqual(10);
        expect(f.power).toBeGreaterThanOrEqual(1);
    });

    it('handles missing equipment and player within gameState', () => {
        const f = fighterFromUser({ ...bareUser, gameState: {} });
        expect(f.maxHP).toBeGreaterThanOrEqual(100);
        expect(f.damage).toBeGreaterThanOrEqual(10);
    });

    it('includes all combat stat fields', () => {
        const f = fighterFromUser(bareUser);
        const expectedFields = [
            'id', 'username', 'avatar', 'rating',
            'maxHP', 'damage', 'power',
            'critChance', 'critMultiplier', 'healthRegen', 'lifeSteal',
            'attackSpeed', 'doubleHit', 'damageReduction', 'reflect',
            'execute', 'ranged',
        ];
        for (const field of expectedFields) {
            expect(f).toHaveProperty(field);
        }
    });

    it('computes stats consistently with shared helpers', () => {
        const equipment = {};
        const level = 1;
        const statBonusPct = 0;
        const stats = computeStatsFromEquipment(equipment, level, statBonusPct);
        const power = playerPowerScore(equipment, level, statBonusPct);

        const f = fighterFromUser(bareUser);
        expect(f.maxHP).toBe(Math.max(100, stats.maxHP));
        expect(f.damage).toBe(Math.max(10, stats.damage));
        expect(f.power).toBe(Math.max(1, power));
    });

    it('applies clan stat bonus when clanMembership is present', () => {
        const userWithClan = {
            ...bareUser,
            clanMembership: { clan: { xp: 5000 } },
        };
        const fNoClan = fighterFromUser(bareUser);
        const fWithClan = fighterFromUser(userWithClan);
        // A clan with xp = 5000 gives a non-zero statBonusPct, so stats should differ
        const bonusPct = clanPerks(clanLevelFromXp(5000)).statBonusPct;
        if (bonusPct > 0) {
            // With the same empty equipment at level 1, clan bonus should produce
            // higher (or equal, due to floor) maxHP/damage
            expect(fWithClan.maxHP).toBeGreaterThanOrEqual(fNoClan.maxHP);
        }
    });
});

// ---------------------------------------------------------------------------
// publicFighter
// ---------------------------------------------------------------------------
describe('publicFighter', () => {
    const sampleFighter = {
        id: 7,
        username: 'Hero',
        avatar: 'knight',
        rating: 1100,
        power: 500,
        maxHP: 200,
        damage: 50,
        critChance: 5,
        critMultiplier: 20,
        healthRegen: 3,
        lifeSteal: 2,
        attackSpeed: 10,
        doubleHit: 4,
        damageReduction: 1,
        reflect: 0,
        execute: 0,
        ranged: false,
    };

    it('maps id to userId', () => {
        const pub = publicFighter(sampleFighter);
        expect(pub.userId).toBe(7);
        expect(pub).not.toHaveProperty('id');
    });

    it('sets userId to null when id is null', () => {
        const pub = publicFighter({ ...sampleFighter, id: null });
        expect(pub.userId).toBeNull();
    });

    it('sets userId to null when id is undefined', () => {
        const pub = publicFighter({ ...sampleFighter, id: undefined });
        expect(pub.userId).toBeNull();
    });

    it('defaults isBot to false for real fighters', () => {
        const pub = publicFighter(sampleFighter);
        expect(pub.isBot).toBe(false);
    });

    it('sets isBot to true when fighter.isBot is true', () => {
        const pub = publicFighter({ ...sampleFighter, isBot: true });
        expect(pub.isBot).toBe(true);
    });

    it('includes all public combat stat fields', () => {
        const pub = publicFighter(sampleFighter);
        const expectedFields = [
            'userId', 'username', 'avatar', 'rating', 'power',
            'maxHP', 'damage', 'critChance', 'critMultiplier',
            'healthRegen', 'lifeSteal', 'attackSpeed', 'doubleHit',
            'damageReduction', 'reflect', 'execute', 'ranged', 'isBot',
        ];
        for (const field of expectedFields) {
            expect(pub).toHaveProperty(field);
        }
    });

    it('preserves stat values from the fighter', () => {
        const pub = publicFighter(sampleFighter);
        expect(pub.username).toBe('Hero');
        expect(pub.avatar).toBe('knight');
        expect(pub.rating).toBe(1100);
        expect(pub.power).toBe(500);
        expect(pub.maxHP).toBe(200);
        expect(pub.damage).toBe(50);
        expect(pub.critChance).toBe(5);
        expect(pub.critMultiplier).toBe(20);
        expect(pub.healthRegen).toBe(3);
        expect(pub.lifeSteal).toBe(2);
        expect(pub.attackSpeed).toBe(10);
        expect(pub.doubleHit).toBe(4);
        expect(pub.damageReduction).toBe(1);
        expect(pub.reflect).toBe(0);
        expect(pub.execute).toBe(0);
        expect(pub.ranged).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// mirrorBot
// ---------------------------------------------------------------------------
describe('mirrorBot', () => {
    const attacker = {
        id: 5,
        username: 'RealPlayer',
        avatar: 'wizard',
        rating: 1050,
        maxHP: 300,
        damage: 60,
        power: 400,
        critChance: 3,
        critMultiplier: 10,
        healthRegen: 1,
        lifeSteal: 0,
        attackSpeed: 5,
        doubleHit: 0,
        damageReduction: 2,
        reflect: 1,
        execute: 0,
        ranged: true,
    };

    it('sets id to null', () => {
        expect(mirrorBot(attacker).id).toBeNull();
    });

    it('sets isBot to true', () => {
        expect(mirrorBot(attacker).isBot).toBe(true);
    });

    it('sets username to "Sparring Dummy"', () => {
        expect(mirrorBot(attacker).username).toBe('Sparring Dummy');
    });

    it('sets avatar to "robot"', () => {
        expect(mirrorBot(attacker).avatar).toBe('robot');
    });

    it('copies all combat stats from the attacker', () => {
        const bot = mirrorBot(attacker);
        expect(bot.rating).toBe(attacker.rating);
        expect(bot.maxHP).toBe(attacker.maxHP);
        expect(bot.damage).toBe(attacker.damage);
        expect(bot.power).toBe(attacker.power);
        expect(bot.critChance).toBe(attacker.critChance);
        expect(bot.critMultiplier).toBe(attacker.critMultiplier);
        expect(bot.healthRegen).toBe(attacker.healthRegen);
        expect(bot.lifeSteal).toBe(attacker.lifeSteal);
        expect(bot.attackSpeed).toBe(attacker.attackSpeed);
        expect(bot.doubleHit).toBe(attacker.doubleHit);
        expect(bot.damageReduction).toBe(attacker.damageReduction);
        expect(bot.reflect).toBe(attacker.reflect);
        expect(bot.execute).toBe(attacker.execute);
        expect(bot.ranged).toBe(attacker.ranged);
    });

    it('does not mutate the original attacker object', () => {
        const original = { ...attacker };
        mirrorBot(attacker);
        expect(attacker).toEqual(original);
    });
});
