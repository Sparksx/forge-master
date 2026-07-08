import { describe, it, expect } from 'vitest';
import {
    MAX_FORGE_LEVEL, FORGE_LEVELS,
    rankKind, stageInfo, arenaFallbackRank,
    arenaEnemyPower, arenaReward, avatarEmoji,
    AVATARS,
} from '../config.js';

describe('rankKind', () => {
    it('returns "normal" for non-boss ranks', () => {
        expect(rankKind(1)).toBe('normal');
        expect(rankKind(5)).toBe('normal');
        expect(rankKind(49)).toBe('normal');
    });

    it('returns "boss" for multiples of 10 that are not multiples of 50', () => {
        expect(rankKind(10)).toBe('boss');
        expect(rankKind(20)).toBe('boss');
    });

    it('returns "bigboss" for multiples of 50', () => {
        expect(rankKind(50)).toBe('bigboss');
        expect(rankKind(100)).toBe('bigboss');
    });
});

describe('stageInfo', () => {
    it('returns chapter 1, sub 1 for rank 1', () => {
        const info = stageInfo(1);
        expect(info).toEqual({
            chapter: 1,
            sub: 1,
            label: 'Hard 1-1',
            progress: 0.1,
        });
    });

    it('returns progress 1 at the end of a chapter', () => {
        const info = stageInfo(10);
        expect(info.chapter).toBe(1);
        expect(info.sub).toBe(10);
        expect(info.progress).toBe(1);
    });

    it('rolls over to the next chapter', () => {
        const info = stageInfo(11);
        expect(info.chapter).toBe(2);
        expect(info.sub).toBe(1);
    });

    it('computes mid-chapter correctly', () => {
        const info = stageInfo(25);
        expect(info.chapter).toBe(3);
        expect(info.sub).toBe(5);
    });
});

describe('arenaFallbackRank', () => {
    it('cannot go below 1', () => {
        expect(arenaFallbackRank(1)).toBe(1);
    });

    it('drops one sub-stage mid-chapter', () => {
        expect(arenaFallbackRank(5)).toBe(4);
        expect(arenaFallbackRank(15)).toBe(14);
    });

    it('stays at the first sub-stage of a chapter', () => {
        expect(arenaFallbackRank(11)).toBe(11);
    });

    it('drops from the end of a chapter to one before', () => {
        expect(arenaFallbackRank(10)).toBe(9);
    });
});

describe('arenaEnemyPower', () => {
    it('returns the base power at rank 1', () => {
        expect(arenaEnemyPower(1)).toBe(45);
    });

    it('is strictly increasing', () => {
        for (let rank = 2; rank <= 50; rank++) {
            expect(arenaEnemyPower(rank)).toBeGreaterThan(arenaEnemyPower(rank - 1));
        }
    });

    it('returns positive integers', () => {
        for (let rank = 1; rank <= 100; rank++) {
            const p = arenaEnemyPower(rank);
            expect(p).toBeGreaterThan(0);
            expect(Number.isInteger(p)).toBe(true);
        }
    });
});

describe('arenaReward', () => {
    it('returns 30 at rank 1', () => {
        expect(arenaReward(1)).toBe(30);
    });

    it('is strictly increasing', () => {
        for (let rank = 2; rank <= 50; rank++) {
            expect(arenaReward(rank)).toBeGreaterThan(arenaReward(rank - 1));
        }
    });
});

describe('avatarEmoji', () => {
    it('returns the wizard emoji for id "wizard"', () => {
        expect(avatarEmoji('wizard')).toBe('\u{1F9D9}');
    });

    it('returns the knight emoji for id "knight"', () => {
        expect(avatarEmoji('knight')).toBe('⚔️');
    });

    it('falls back to the wizard emoji for an unknown id', () => {
        expect(avatarEmoji('nonexistent')).toBe(AVATARS[0].emoji);
    });

    it('resolves a premium avatar', () => {
        expect(avatarEmoji('ninja')).toBe('\u{1F977}');
    });
});

describe('FORGE_LEVELS table integrity', () => {
    it('has exactly MAX_FORGE_LEVEL rows', () => {
        expect(FORGE_LEVELS.length).toBe(MAX_FORGE_LEVEL);
    });

    it('every chances array sums to 100', () => {
        for (const { chances } of FORGE_LEVELS) {
            expect(chances.reduce((a, b) => a + b, 0)).toBe(100);
        }
    });

    it('cost is monotonically non-decreasing', () => {
        for (let i = 1; i < FORGE_LEVELS.length; i++) {
            expect(FORGE_LEVELS[i].cost).toBeGreaterThanOrEqual(FORGE_LEVELS[i - 1].cost);
        }
    });

    it('each chances array has exactly 7 elements', () => {
        for (const { chances } of FORGE_LEVELS) {
            expect(chances).toHaveLength(7);
        }
    });

    it('contains no negative chances', () => {
        for (const { chances } of FORGE_LEVELS) {
            for (const c of chances) {
                expect(c).toBeGreaterThanOrEqual(0);
            }
        }
    });
});
