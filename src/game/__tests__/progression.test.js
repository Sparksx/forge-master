import { describe, it, expect } from 'vitest';
import {
    MAX_FORGE_LEVEL, MAX_TIER, FORGE_LEVELS, forgeXpForLevel, forgeXpForRarity,
    forgesForLevel, playerXpForLevel, arenaXp, arenaFallbackRank, stageInfo,
} from '../config.js';

describe('arena loss fallback', () => {
    it('drops one sub-stage on a loss (3-5 → 3-4)', () => {
        const rank = 25; // chapter 3, sub 5
        expect(stageInfo(rank).label).toBe('Hard 3-5');
        const back = arenaFallbackRank(rank);
        expect(stageInfo(back).label).toBe('Hard 3-4');
    });

    it('never drops below the chapter floor (3-1 stays 3-1)', () => {
        const rank = 21; // chapter 3, sub 1
        expect(stageInfo(rank).label).toBe('Hard 3-1');
        expect(arenaFallbackRank(rank)).toBe(21);
    });

    it('holds at the very first stage', () => {
        expect(arenaFallbackRank(1)).toBe(1);
    });

    it('only ever moves one sub-stage and never crosses a chapter', () => {
        for (let rank = 1; rank <= 120; rank++) {
            const back = arenaFallbackRank(rank);
            expect(back).toBeGreaterThanOrEqual(1);
            expect(rank - back).toBeLessThanOrEqual(1);
            expect(stageInfo(back).chapter).toBe(stageInfo(rank).chapter);
        }
    });
});

describe('forge XP rarity weighting', () => {
    it('grants at least 1 XP for the lowest rarity', () => {
        expect(forgeXpForRarity(1)).toBeGreaterThanOrEqual(1);
    });

    it('grants more XP for rarer rolls', () => {
        expect(forgeXpForRarity(MAX_TIER)).toBeGreaterThan(forgeXpForRarity(1));
        for (let t = 2; t <= MAX_TIER; t++) {
            expect(forgeXpForRarity(t)).toBeGreaterThanOrEqual(forgeXpForRarity(t - 1));
        }
    });
});

describe('forge XP curve', () => {
    it('requires more XP at higher forge levels', () => {
        expect(forgeXpForLevel(2)).toBeGreaterThan(forgeXpForLevel(1));
        expect(forgeXpForLevel(MAX_FORGE_LEVEL - 1)).toBeGreaterThan(forgeXpForLevel(1));
    });

    it('returns null once the forge is maxed', () => {
        expect(forgeXpForLevel(MAX_FORGE_LEVEL)).toBeNull();
        expect(forgeXpForLevel(MAX_FORGE_LEVEL + 5)).toBeNull();
    });
});

// The forge rarity rows are generated from a math model (see docs/forge-balance.md
// and docs/forge-curve.gen.mjs). These tests lock in the design constraints so a
// hand-edit that breaks them fails loudly — re-run the generator instead.
describe('forge rarity curve (generated)', () => {
    it('has 35 levels', () => {
        expect(MAX_FORGE_LEVEL).toBe(35);
    });

    it('starts at 100% Common', () => {
        expect(FORGE_LEVELS[0].chances).toEqual([100, 0, 0, 0, 0, 0, 0]);
    });

    it('every level’s odds sum to 100', () => {
        for (const { chances } of FORGE_LEVELS) {
            expect(chances.reduce((a, b) => a + b, 0)).toBe(100);
        }
    });

    it('never offers more than 4 rarities at once', () => {
        for (const { chances } of FORGE_LEVELS) {
            expect(chances.filter((c) => c > 0).length).toBeLessThanOrEqual(4);
        }
    });

    it('caps the top rarity (Divine) at 20% at max forge level', () => {
        expect(FORGE_LEVELS[MAX_FORGE_LEVEL - 1].chances[MAX_TIER - 1]).toBe(20);
    });

    it('retires the lowest rarities to exactly 0 (Common, Uncommon, Rare)', () => {
        const top = FORGE_LEVELS[MAX_FORGE_LEVEL - 1].chances;
        expect(top[0]).toBe(0); // Common
        expect(top[1]).toBe(0); // Uncommon
        expect(top[2]).toBe(0); // Rare
    });

    it('introduces each higher rarity later than the one below it', () => {
        const firstSeen = (tier) => FORGE_LEVELS.findIndex((l) => l.chances[tier] > 0);
        for (let t = 1; t < MAX_TIER; t++) {
            expect(firstSeen(t)).toBeGreaterThan(firstSeen(t - 1));
        }
    });

    it('gold shortcut cost is non-decreasing', () => {
        for (let i = 1; i < FORGE_LEVELS.length; i++) {
            expect(FORGE_LEVELS[i].cost).toBeGreaterThanOrEqual(FORGE_LEVELS[i - 1].cost);
        }
    });
});

describe('forge pacing (forges per level)', () => {
    it('takes ~100 forges for the first level', () => {
        expect(forgesForLevel(1)).toBe(100);
    });

    it('strictly increases per level', () => {
        for (let L = 2; L < MAX_FORGE_LEVEL; L++) {
            expect(forgesForLevel(L)).toBeGreaterThan(forgesForLevel(L - 1));
        }
    });

    it('totals at least 1,000,000 forges to reach the cap', () => {
        let total = 0;
        for (let L = 1; L < MAX_FORGE_LEVEL; L++) total += forgesForLevel(L);
        expect(total).toBeGreaterThanOrEqual(1_000_000);
    });
});

describe('player XP curve', () => {
    it('requires more XP at higher levels', () => {
        expect(playerXpForLevel(2)).toBeGreaterThan(playerXpForLevel(1));
        expect(playerXpForLevel(50)).toBeGreaterThan(playerXpForLevel(10));
    });

    it('always returns a positive requirement', () => {
        for (let lvl = 1; lvl <= 200; lvl++) {
            expect(playerXpForLevel(lvl)).toBeGreaterThan(0);
        }
    });
});

describe('arena XP reward', () => {
    it('grants more XP at higher ranks', () => {
        expect(arenaXp(10)).toBeGreaterThan(arenaXp(1));
    });

    it('is always positive', () => {
        expect(arenaXp(1)).toBeGreaterThan(0);
    });
});
