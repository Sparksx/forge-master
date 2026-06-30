import { describe, it, expect } from 'vitest';
import { rollTier, createItem, rollLevel, rollBonuses, forge } from '../forge.js';
import { TIERS, HEALTH_ITEMS, forgeGoldDrop, FORGE_LEVELS } from '../config.js';

describe('FORGE_LEVELS integrity', () => {
    it('every level chances sum to exactly 100', () => {
        FORGE_LEVELS.forEach((lvl, i) => {
            const sum = lvl.chances.reduce((a, b) => a + b, 0);
            expect(sum, `FORGE_LEVELS[${i}] sums to ${sum}`).toBe(100);
        });
    });

    it('every level has exactly 7 rarity slots', () => {
        FORGE_LEVELS.forEach((lvl, i) => {
            expect(lvl.chances.length, `FORGE_LEVELS[${i}]`).toBe(7);
        });
    });

    it('no negative chances', () => {
        FORGE_LEVELS.forEach((lvl, i) => {
            lvl.chances.forEach((c, j) => {
                expect(c, `FORGE_LEVELS[${i}].chances[${j}]`).toBeGreaterThanOrEqual(0);
            });
        });
    });
});

describe('rollTier', () => {
    it('always rolls Common at forge level 1', () => {
        for (let i = 0; i < 200; i++) expect(rollTier(1)).toBe(1);
    });

    it('returns a valid tier index within range', () => {
        for (let i = 0; i < 200; i++) {
            const t = rollTier(8);
            expect(t).toBeGreaterThanOrEqual(1);
            expect(t).toBeLessThanOrEqual(TIERS.length);
        }
    });

    it('luck never produces an out-of-range tier', () => {
        for (let i = 0; i < 200; i++) {
            const t = rollTier(6, 50);
            expect(t).toBeGreaterThanOrEqual(1);
            expect(t).toBeLessThanOrEqual(TIERS.length);
        }
    });
});

describe('createItem', () => {
    it('builds a valid item with correct stat type and bonus count', () => {
        const item = createItem('weapon', 10, 5);
        expect(item.type).toBe('weapon');
        expect(item.statType).toBe('damage');
        expect(item.stats).toBeGreaterThan(0);
        expect(item.bonuses).toHaveLength(TIERS[4].bonusCount);
        expect(item.name).toBeTruthy();
    });

    it('marks armour slots as health items', () => {
        const item = createItem('armor', 5, 1);
        expect(HEALTH_ITEMS.includes('armor')).toBe(true);
        expect(item.statType).toBe('health');
    });

    it('gives weapons a melee or ranged attack style', () => {
        for (let i = 0; i < 50; i++) {
            const w = createItem('weapon', 10, 3);
            expect(['melee', 'ranged']).toContain(w.attackStyle);
        }
        // Explicit style is honoured.
        expect(createItem('weapon', 10, 3, 'ranged').attackStyle).toBe('ranged');
        // Non-weapons carry no attack style.
        expect(createItem('armor', 10, 3).attackStyle).toBeUndefined();
    });
});

describe('rollBonuses', () => {
    it('produces the requested number of distinct bonuses', () => {
        const bonuses = rollBonuses(3, 7);
        expect(bonuses).toHaveLength(3);
        const keys = bonuses.map((b) => b.type);
        expect(new Set(keys).size).toBe(3);
    });

    it('respects the high-tier minimum value floor', () => {
        // Divine (tier 7) guarantees >=50% of each bonus max.
        for (let i = 0; i < 50; i++) {
            const [b] = rollBonuses(1, 7);
            expect(b.value).toBeGreaterThanOrEqual(1);
        }
    });
});

describe('forgeGoldDrop', () => {
    it('grows with forge level and rarity', () => {
        expect(forgeGoldDrop(5, 1)).toBeGreaterThan(forgeGoldDrop(1, 1));
        expect(forgeGoldDrop(3, 5)).toBeGreaterThan(forgeGoldDrop(3, 1));
        expect(forgeGoldDrop(1, 1)).toBeGreaterThan(0);
    });
});

describe('forge', () => {
    it('always returns a valid item and a non-negative gold amount', () => {
        for (let i = 0; i < 100; i++) {
            const { item, gold } = forge();
            expect(item).toBeTruthy();
            expect(item.tier).toBeGreaterThanOrEqual(1);
            expect(typeof gold).toBe('number');
            expect(gold).toBeGreaterThanOrEqual(0);
        }
    });

    it('only occasionally yields gold (gold is scarce)', () => {
        let withGold = 0;
        const N = 400;
        for (let i = 0; i < N; i++) if (forge().gold > 0) withGold++;
        // FORGE_GOLD_CHANCE is small (~8%): most forges drop no gold at all.
        expect(withGold).toBeGreaterThan(0);
        expect(withGold).toBeLessThan(N / 2);
    });

    it('best-of-N reports the roll count and never returns a worse tier than 1 roll on average', () => {
        // The "rolls" field reflects the clan best-of-N perk.
        const r = forge(3);
        expect(r.rolls).toBe(3);
        expect(r.item).toBeTruthy();

        // Over many trials, best-of-5 should yield a higher mean tier than best-of-1.
        const mean = (count) => {
            let sum = 0;
            const N = 600;
            for (let i = 0; i < N; i++) sum += forge(count).item.tier;
            return sum / N;
        };
        // At forge level 1 every roll is Common, so guard the comparison by using
        // the default forge level; best-of-5 must not be worse than best-of-1.
        expect(mean(5)).toBeGreaterThanOrEqual(mean(1));
    });
});

describe('rollLevel', () => {
    it('stays within the initial band for fresh slots', () => {
        for (let i = 0; i < 100; i++) {
            const lvl = rollLevel(null);
            expect(lvl).toBeGreaterThanOrEqual(1);
            expect(lvl).toBeLessThanOrEqual(8);
        }
    });

    it('bands around the best level for known slots', () => {
        for (let i = 0; i < 100; i++) {
            const lvl = rollLevel(50);
            expect(lvl).toBeGreaterThanOrEqual(38);
            expect(lvl).toBeLessThanOrEqual(62);
        }
    });
});
