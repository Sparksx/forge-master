import { describe, it, expect } from 'vitest';
import { makeEnemy, makeEncounter, simulateDuel, simulateBattle, computeHit, encounterReward } from '../arena.js';
import { arenaEnemyPower, arenaReward, rankKind, MAX_GROUP, BASE_ATTACK_PERIOD, seededRng } from '../config.js';

describe('arena scaling', () => {
    it('enemy power increases with rank', () => {
        expect(arenaEnemyPower(2)).toBeGreaterThan(arenaEnemyPower(1));
        expect(arenaEnemyPower(10)).toBeGreaterThan(arenaEnemyPower(5));
    });

    it('reward increases with rank', () => {
        expect(arenaReward(5)).toBeGreaterThan(arenaReward(1));
    });

    it('makeEnemy returns combat-ready stats', () => {
        const e = makeEnemy(3);
        expect(e.maxHP).toBeGreaterThan(0);
        expect(e.damage).toBeGreaterThan(0);
        expect(e.name).toBeTruthy();
    });
});

describe('encounters', () => {
    it('classifies bosses every 10 and big bosses every 50 ranks', () => {
        expect(rankKind(3)).toBe('normal');
        expect(rankKind(10)).toBe('boss');
        expect(rankKind(20)).toBe('boss');
        expect(rankKind(50)).toBe('bigboss');
        expect(rankKind(100)).toBe('bigboss');
    });

    it('is deterministic — same rank yields the same line-up', () => {
        expect(makeEncounter(17)).toEqual(makeEncounter(17));
        expect(makeEncounter(50)).toEqual(makeEncounter(50));
    });

    it('always fields between 1 and MAX_GROUP combat-ready enemies', () => {
        for (let rank = 1; rank <= 120; rank++) {
            const { enemies } = makeEncounter(rank);
            expect(enemies.length).toBeGreaterThanOrEqual(1);
            expect(enemies.length).toBeLessThanOrEqual(MAX_GROUP);
            for (const e of enemies) {
                expect(e.maxHP).toBeGreaterThan(0);
                expect(e.damage).toBeGreaterThan(0);
                expect(e.name).toBeTruthy();
            }
        }
    });

    it('boss ranks lead with a boss-role enemy', () => {
        expect(makeEncounter(10).kind).toBe('boss');
        expect(makeEncounter(10).enemies[0].role).toBe('boss');
        expect(makeEncounter(50).kind).toBe('bigboss');
        expect(makeEncounter(50).enemies[0].role).toBe('bigboss');
    });

    it('early ranks stay a single enemy, later ranks grow the pack', () => {
        expect(makeEncounter(1).enemies).toHaveLength(1);
        expect(makeEncounter(33).enemies.length).toBeGreaterThan(1);
    });
});

describe('simulateBattle (group combat)', () => {
    const tough = { maxHP: 100000, damage: 5000, critChance: 0, critMultiplier: 0, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };
    const weakling = () => ({ maxHP: 80, damage: 5, critChance: 0, critMultiplier: 0, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 });

    it('a lone strong hero clears a weak pack', () => {
        const { win, events } = simulateBattle([tough], [weakling(), weakling(), weakling()]);
        expect(win).toBe(true);
        expect(events.length).toBeGreaterThan(0);
    });

    it('a weak hero loses to a strong pack', () => {
        const { win } = simulateBattle([weakling()], [tough, tough]);
        expect(win).toBe(false);
    });

    it('always terminates with a boolean result', () => {
        const a = { maxHP: 1000, damage: 50, critChance: 5, critMultiplier: 50, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };
        const { win } = simulateBattle([a], [{ ...a }, { ...a }]);
        expect(typeof win).toBe('boolean');
    });

    it('ranged fighters strike before melee at equal stats', () => {
        const base = { maxHP: 5000, damage: 20, critChance: 0, critMultiplier: 0, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };
        const { events } = simulateBattle([{ ...base, ranged: true }], [{ ...base, ranged: false }]);
        // The very first hit lands at the ranged head-start, well under one period.
        expect(events[0].bySide).toBe('ally');
        expect(events[0].t).toBeLessThan(BASE_ATTACK_PERIOD);
    });
});

describe('simulateDuel (1v1 compatibility)', () => {
    const strong = { maxHP: 5000, damage: 400, critChance: 20, critMultiplier: 80, attackSpeed: 20, lifeSteal: 10, healthRegen: 2 };
    const weak = { maxHP: 200, damage: 10, critChance: 0, critMultiplier: 0, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };

    it('a far stronger fighter wins', () => {
        const { win, events } = simulateDuel(strong, weak);
        expect(win).toBe(true);
        expect(events.length).toBeGreaterThan(0);
        expect(events[0]).toHaveProperty('pHp');
        expect(events[0]).toHaveProperty('eHp');
    });

    it('a far weaker fighter loses', () => {
        const { win } = simulateDuel(weak, strong);
        expect(win).toBe(false);
    });
});

describe('real-time combat helpers', () => {
    it('computeHit returns a positive damage roll and crit flag', () => {
        for (let i = 0; i < 50; i++) {
            const { dmg, crit } = computeHit({ damage: 100, critChance: 50, critMultiplier: 100 });
            expect(dmg).toBeGreaterThanOrEqual(1);
            expect(typeof crit).toBe('boolean');
        }
        // Never-crit fighters stay near their base damage (±10% variance).
        const { dmg, crit } = computeHit({ damage: 100, critChance: 0, critMultiplier: 0 });
        expect(crit).toBe(false);
        expect(dmg).toBeGreaterThanOrEqual(90);
        expect(dmg).toBeLessThanOrEqual(110);
    });

    it('computeHit is deterministic when driven by a seeded RNG (replayable)', () => {
        const att = { damage: 100, critChance: 40, critMultiplier: 75 };
        const runA = Array.from({ length: 20 }, (() => { const r = seededRng(123); return () => computeHit(att, r); })());
        const runB = Array.from({ length: 20 }, (() => { const r = seededRng(123); return () => computeHit(att, r); })());
        expect(runA).toEqual(runB);
        // A different seed diverges (otherwise it isn't really seeded).
        const r = seededRng(456);
        const runC = Array.from({ length: 20 }, () => computeHit(att, r));
        expect(runC).not.toEqual(runA);
    });

    it('encounterReward only pays out for bosses, and only on a win', () => {
        // Gold is scarce: normal packs never drop gold, win or lose.
        expect(encounterReward(10, 'normal', true)).toBe(0);
        expect(encounterReward(10, 'normal', false)).toBe(0);
        // Bosses pay only when beaten — a loss drops nothing.
        expect(encounterReward(10, 'boss', false)).toBe(0);
        expect(encounterReward(10, 'boss', true)).toBeGreaterThan(0);
        // Big bosses pay more than regular bosses at the same rank.
        expect(encounterReward(50, 'bigboss', true)).toBeGreaterThan(encounterReward(50, 'boss', true));
    });
});
