import { describe, it, expect } from 'vitest';
import {
    MAX_FORGE_LEVEL, MAX_TIER, forgeXpForLevel, forgeXpForRarity, playerXpForLevel, arenaXp,
    arenaFallbackRank, stageInfo,
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
