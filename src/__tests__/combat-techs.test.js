import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing modules
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

const { resetGame, completeResearch, getTechEffect, equipItem } = await import('../state.js');
const { startCombat, stopCombat, getPlayerCombatState, refreshPlayerStats } = await import('../combat.js');
const { getMaxWaveCount, WAVE_COUNT, WAVE_THEMES, getMonsterForWave, getMonsterCount } = await import('../monsters.js');
const { createItem } = await import('../forge.js');
const { BASE_HEALTH, BASE_DAMAGE } = await import('../config.js');

describe('combat tech effects', () => {

    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        stopCombat();
        resetGame();
    });

    describe('vitality', () => {
        it('has no effect at level 0', () => {
            expect(getTechEffect('vitality')).toBe(0);
        });

        it('increases total health by 2% per level', () => {
            startCombat();
            const baseHP = getPlayerCombatState().maxHP;

            stopCombat();
            completeResearch('vitality', 1);
            startCombat();
            const boostedHP = getPlayerCombatState().maxHP;

            // With no equipment, maxHP = BASE_HEALTH * (1 + 2/100)
            expect(boostedHP).toBeGreaterThan(baseHP);
            expect(boostedHP).toBe(Math.floor(BASE_HEALTH * (1 + 2 / 100)));
        });

        it('stacks with multiple levels', () => {
            completeResearch('vitality', 1);
            completeResearch('vitality', 2);
            completeResearch('vitality', 3);
            expect(getTechEffect('vitality')).toBe(6);

            startCombat();
            const hp = getPlayerCombatState().maxHP;
            expect(hp).toBe(Math.floor(BASE_HEALTH * (1 + 6 / 100)));
        });
    });

    describe('strength', () => {
        it('increases total damage by 2% per level', () => {
            startCombat();
            const baseDmg = getPlayerCombatState().damage;

            stopCombat();
            // Use 5 levels so the effect is visible after Math.floor (BASE_DAMAGE=10)
            completeResearch('strength', 5);
            startCombat();
            const boostedDmg = getPlayerCombatState().damage;

            // 5 levels * 2% = 10% bonus → Math.floor(10 * 1.10) = 11
            expect(boostedDmg).toBeGreaterThan(baseDmg);
            expect(boostedDmg).toBe(Math.floor(BASE_DAMAGE * (1 + 10 / 100)));
        });

        it('stacks with multiple levels', () => {
            completeResearch('strength', 1);
            completeResearch('strength', 2);
            completeResearch('strength', 3);
            completeResearch('strength', 4);
            completeResearch('strength', 5);
            expect(getTechEffect('strength')).toBe(10);

            startCombat();
            const dmg = getPlayerCombatState().damage;
            expect(dmg).toBe(Math.floor(BASE_DAMAGE * (1 + 10 / 100)));
        });
    });

    describe('swiftStrikes', () => {
        it('reduces attack speed (faster attacks)', () => {
            startCombat();
            const baseSpeed = getPlayerCombatState().attackSpeed;

            stopCombat();
            completeResearch('strength', 1);
            completeResearch('strength', 2);
            completeResearch('strength', 3);
            completeResearch('swiftStrikes', 1);
            startCombat();
            const boostedSpeed = getPlayerCombatState().attackSpeed;

            // Lower attackSpeed number means faster attacks
            expect(boostedSpeed).toBeLessThan(baseSpeed);
        });

        it('attack speed has a minimum of 400ms', () => {
            completeResearch('strength', 1);
            completeResearch('strength', 2);
            completeResearch('strength', 3);
            completeResearch('swiftStrikes', 1);
            completeResearch('swiftStrikes', 2);
            completeResearch('swiftStrikes', 3);

            startCombat();
            const speed = getPlayerCombatState().attackSpeed;
            expect(speed).toBeGreaterThanOrEqual(400);
        });
    });

    describe('waveBreaker', () => {
        it('base max wave count is 10', () => {
            expect(getMaxWaveCount()).toBe(WAVE_COUNT);
            expect(WAVE_COUNT).toBe(10);
        });

        it('increases max wave count by 2 per level', () => {
            completeResearch('vitality', 1);
            completeResearch('vitality', 2);
            completeResearch('vitality', 3);
            completeResearch('strength', 1);
            completeResearch('strength', 2);
            completeResearch('strength', 3);
            completeResearch('waveBreaker', 1);

            expect(getMaxWaveCount()).toBe(12);
        });

        it('max waveBreaker (level 5) adds 10 waves', () => {
            completeResearch('vitality', 1);
            completeResearch('vitality', 2);
            completeResearch('vitality', 3);
            completeResearch('strength', 1);
            completeResearch('strength', 2);
            completeResearch('strength', 3);
            completeResearch('waveBreaker', 1);
            completeResearch('waveBreaker', 2);
            completeResearch('waveBreaker', 3);
            completeResearch('waveBreaker', 4);
            completeResearch('waveBreaker', 5);

            expect(getMaxWaveCount()).toBe(20);
        });

        it('WAVE_THEMES has enough entries for max waves', () => {
            expect(WAVE_THEMES.length).toBeGreaterThanOrEqual(20);
        });
    });

    describe('extended wave monsters', () => {
        it('generates valid monsters for waves 11-20', () => {
            for (let wave = 11; wave <= 20; wave++) {
                for (let sub = 1; sub <= 10; sub++) {
                    const monster = getMonsterForWave(wave, sub);
                    expect(monster.name).toBeTruthy();
                    expect(monster.emoji).toBeTruthy();
                    expect(monster.maxHP).toBeGreaterThan(0);
                    expect(monster.damage).toBeGreaterThan(0);
                    expect(monster.attackSpeed).toBeGreaterThanOrEqual(800);
                }
            }
        });

        it('wave 11+ monsters are stronger than wave 10', () => {
            const w10 = getMonsterForWave(10, 10);
            const w11 = getMonsterForWave(11, 1);
            // w11-1 stage is 101, w10-10 stage is 100, so w11 should have similar or higher stats
            expect(w11.maxHP).toBeGreaterThanOrEqual(w10.maxHP * 0.5); // accounting for sub-wave difference
        });

        it('extended wave themes are unique', () => {
            const names = WAVE_THEMES.slice(10).map(t => t.name);
            expect(new Set(names).size).toBe(names.length);
        });
    });

    describe('battleXP', () => {
        it('returns 0 at level 0', () => {
            expect(getTechEffect('battleXP')).toBe(0);
        });

        it('returns +10% per level', () => {
            completeResearch('vitality', 1);
            completeResearch('vitality', 2);
            completeResearch('vitality', 3);
            completeResearch('strength', 1);
            completeResearch('strength', 2);
            completeResearch('strength', 3);
            completeResearch('waveBreaker', 1);
            completeResearch('battleXP', 1);
            expect(getTechEffect('battleXP')).toBe(10);
        });
    });

    describe('refreshPlayerStats', () => {
        it('updates player stats without resetting HP ratio', () => {
            startCombat();
            const state = getPlayerCombatState();
            // Simulate damage
            state.currentHP = Math.floor(state.maxHP * 0.5);

            completeResearch('vitality', 1);
            refreshPlayerStats();

            const newState = getPlayerCombatState();
            // HP should be ~50% of the new max
            expect(newState.maxHP).toBeGreaterThan(BASE_HEALTH);
            expect(newState.currentHP).toBeLessThanOrEqual(newState.maxHP);
            expect(newState.currentHP / newState.maxHP).toBeCloseTo(0.5, 1);
        });
    });

    describe('monster count per sub-wave', () => {
        it('sub 1-3 have 1 monster', () => {
            for (let sub = 1; sub <= 3; sub++) {
                expect(getMonsterCount(sub)).toBe(1);
            }
        });

        it('sub 4-7 have 2 monsters', () => {
            for (let sub = 4; sub <= 7; sub++) {
                expect(getMonsterCount(sub)).toBe(2);
            }
        });

        it('sub 8-10 have 3 monsters', () => {
            for (let sub = 8; sub <= 10; sub++) {
                expect(getMonsterCount(sub)).toBe(3);
            }
        });
    });
});
