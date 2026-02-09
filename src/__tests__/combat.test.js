import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const { getMonsterForWave, getWaveLabel, getMonsterCount, WAVE_COUNT, SUB_WAVE_COUNT, WAVE_THEMES } = await import('../monsters.js');
const { resetGame, getCombatProgress, setCombatWave, equipItem } = await import('../state.js');
const { createItem } = await import('../forge.js');

describe('monsters', () => {
    it('generates monster for wave 1-1', () => {
        const m = getMonsterForWave(1, 1);
        expect(m.name).toBe('Rat Scout');
        expect(m.emoji).toBe('🐀');
        expect(m.maxHP).toBeGreaterThan(0);
        expect(m.damage).toBeGreaterThan(0);
        expect(m.attackSpeed).toBeGreaterThan(0);
        expect(m.wave).toBe(1);
        expect(m.subWave).toBe(1);
    });

    it('generates stronger monsters at higher waves', () => {
        const m1 = getMonsterForWave(1, 1);
        const m5 = getMonsterForWave(5, 1);
        const m10 = getMonsterForWave(10, 1);
        expect(m5.maxHP).toBeGreaterThan(m1.maxHP);
        expect(m10.maxHP).toBeGreaterThan(m5.maxHP);
        expect(m5.damage).toBeGreaterThan(m1.damage);
        expect(m10.damage).toBeGreaterThan(m5.damage);
    });

    it('generates stronger monsters at higher sub-waves', () => {
        const m1 = getMonsterForWave(3, 1);
        const m5 = getMonsterForWave(3, 5);
        const m10 = getMonsterForWave(3, 10);
        expect(m5.maxHP).toBeGreaterThan(m1.maxHP);
        expect(m10.maxHP).toBeGreaterThan(m5.maxHP);
    });

    it('has a theme for every wave', () => {
        expect(WAVE_THEMES).toHaveLength(WAVE_COUNT);
        for (let w = 1; w <= WAVE_COUNT; w++) {
            const theme = WAVE_THEMES[w - 1];
            expect(theme.emoji).toBeTruthy();
            expect(theme.name).toBeTruthy();
            expect(theme.color).toBeTruthy();
        }
    });

    it('generates valid monsters for all wave/sub-wave combinations', () => {
        for (let w = 1; w <= WAVE_COUNT; w++) {
            for (let s = 1; s <= SUB_WAVE_COUNT; s++) {
                const m = getMonsterForWave(w, s);
                expect(m.maxHP).toBeGreaterThan(0);
                expect(m.damage).toBeGreaterThan(0);
                expect(m.attackSpeed).toBeGreaterThanOrEqual(800);
                expect(m.name).toBeTruthy();
            }
        }
    });

    it('monsters get faster at higher waves but not below 800ms', () => {
        const m1 = getMonsterForWave(1, 1);
        const m10 = getMonsterForWave(10, 10);
        expect(m10.attackSpeed).toBeLessThanOrEqual(m1.attackSpeed);
        expect(m10.attackSpeed).toBeGreaterThanOrEqual(800);
    });

    it('wave 1 monsters are significantly harder than old scaling', () => {
        // With the new formula, wave 1-1 should have substantially more HP
        // than the old formula (which was BASE_HP=50 * 1^1.8 * 1^1.15 = 50)
        const m = getMonsterForWave(1, 1);
        expect(m.maxHP).toBeGreaterThan(80);
        expect(m.damage).toBeGreaterThan(10);
    });

    it('wave 2 monsters are much harder than wave 1', () => {
        const m1_10 = getMonsterForWave(1, 10);
        const m2_1 = getMonsterForWave(2, 1);
        // Wave 2 first monster should be harder than wave 1 last monster
        expect(m2_1.maxHP).toBeGreaterThan(m1_10.maxHP);
    });
});

describe('monster count', () => {
    it('sub-waves 1-3 have 1 monster', () => {
        expect(getMonsterCount(1)).toBe(1);
        expect(getMonsterCount(2)).toBe(1);
        expect(getMonsterCount(3)).toBe(1);
    });

    it('sub-waves 4-7 have 2 monsters', () => {
        expect(getMonsterCount(4)).toBe(2);
        expect(getMonsterCount(5)).toBe(2);
        expect(getMonsterCount(6)).toBe(2);
        expect(getMonsterCount(7)).toBe(2);
    });

    it('sub-waves 8-10 have 3 monsters', () => {
        expect(getMonsterCount(8)).toBe(3);
        expect(getMonsterCount(9)).toBe(3);
        expect(getMonsterCount(10)).toBe(3);
    });
});

describe('wave labels', () => {
    it('formats wave labels correctly', () => {
        expect(getWaveLabel(1, 1)).toBe('1-1');
        expect(getWaveLabel(5, 7)).toBe('5-7');
        expect(getWaveLabel(10, 10)).toBe('10-10');
    });
});

describe('combat state', () => {
    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    it('starts at wave 1-1', () => {
        const progress = getCombatProgress();
        expect(progress.currentWave).toBe(1);
        expect(progress.currentSubWave).toBe(1);
    });

    it('advances wave correctly', () => {
        setCombatWave(3, 5);
        const progress = getCombatProgress();
        expect(progress.currentWave).toBe(3);
        expect(progress.currentSubWave).toBe(5);
    });

    it('tracks highest wave reached', () => {
        setCombatWave(5, 3);
        setCombatWave(2, 1); // go back
        const progress = getCombatProgress();
        expect(progress.currentWave).toBe(2);
        expect(progress.currentSubWave).toBe(1);
        expect(progress.highestWave).toBe(5);
        expect(progress.highestSubWave).toBe(3);
    });

    it('saves combat progress to localStorage', () => {
        setCombatWave(3, 7);
        expect(localStorageMock.setItem).toHaveBeenCalled();
        const saved = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)[1]);
        expect(saved.combat.currentWave).toBe(3);
        expect(saved.combat.currentSubWave).toBe(7);
    });

    it('resets combat on resetGame', () => {
        setCombatWave(5, 5);
        resetGame();
        const progress = getCombatProgress();
        expect(progress.currentWave).toBe(1);
        expect(progress.currentSubWave).toBe(1);
        expect(progress.highestWave).toBe(1);
        expect(progress.highestSubWave).toBe(1);
    });
});

describe('wave progression rules', () => {
    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    it('losing at X-Y (Y>1) sends back to X-(Y-1)', () => {
        setCombatWave(5, 5);
        // Simulate defeat: go back one sub-wave
        const { currentWave, currentSubWave } = getCombatProgress();
        let nextSub = currentSubWave - 1;
        if (nextSub < 1) nextSub = 1;
        setCombatWave(currentWave, nextSub);
        const after = getCombatProgress();
        expect(after.currentWave).toBe(5);
        expect(after.currentSubWave).toBe(4);
    });

    it('losing at X-1 stays at X-1', () => {
        setCombatWave(5, 1);
        const { currentWave, currentSubWave } = getCombatProgress();
        let nextSub = currentSubWave - 1;
        if (nextSub < 1) nextSub = 1;
        setCombatWave(currentWave, nextSub);
        const after = getCombatProgress();
        expect(after.currentWave).toBe(5);
        expect(after.currentSubWave).toBe(1);
    });

    it('winning advances sub-wave', () => {
        setCombatWave(3, 5);
        // Simulate win: next sub-wave
        const { currentWave, currentSubWave } = getCombatProgress();
        let nextWave = currentWave;
        let nextSub = currentSubWave + 1;
        if (nextSub > SUB_WAVE_COUNT) {
            nextSub = 1;
            nextWave += 1;
        }
        setCombatWave(nextWave, nextSub);
        const after = getCombatProgress();
        expect(after.currentWave).toBe(3);
        expect(after.currentSubWave).toBe(6);
    });

    it('winning at X-10 advances to (X+1)-1', () => {
        setCombatWave(3, 10);
        const { currentWave, currentSubWave } = getCombatProgress();
        let nextWave = currentWave;
        let nextSub = currentSubWave + 1;
        if (nextSub > SUB_WAVE_COUNT) {
            nextSub = 1;
            nextWave += 1;
        }
        setCombatWave(nextWave, nextSub);
        const after = getCombatProgress();
        expect(after.currentWave).toBe(4);
        expect(after.currentSubWave).toBe(1);
    });
});
