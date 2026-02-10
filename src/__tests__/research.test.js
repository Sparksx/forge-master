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

const {
    resetGame, getEssence, addEssence, spendEssence, getTechLevel,
    getTechEffect, getResearchState, setResearchActive, completeResearch,
    getResearchQueue, addToResearchQueue, shiftResearchQueue, getGold, addGold,
} = await import('../state.js');

const {
    isTechUnlocked, isTechMaxed, getEffectiveResearchCost,
    canStartResearch, startResearch, getResearchStatus,
    checkResearchComplete, speedUpResearch, initResearch,
    startResearchTimer, stopResearchTimer,
} = await import('../research.js');

const { getResearchCost } = await import('../tech-config.js');
const { SPEED_UP_GOLD_PER_SECOND } = await import('../config.js');

describe('research engine', () => {

    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
        stopResearchTimer();
    });

    describe('isTechUnlocked', () => {
        it('returns true for techs with no prerequisites', () => {
            expect(isTechUnlocked('vitality')).toBe(true);
            expect(isTechUnlocked('strength')).toBe(true);
            expect(isTechUnlocked('goldRush')).toBe(true);
            expect(isTechUnlocked('forgeMultiple')).toBe(true);
            expect(isTechUnlocked('armorMastery')).toBe(true);
            expect(isTechUnlocked('weaponMastery')).toBe(true);
        });

        it('returns false for techs with unmet prerequisites', () => {
            // swiftStrikes requires strength level 2
            expect(isTechUnlocked('swiftStrikes')).toBe(false);
        });

        it('returns true when prerequisites are met', () => {
            // Manually set strength to level 2
            completeResearch('strength', 1);
            // Clear active so completeResearch doesn't interfere
            completeResearch('strength', 2);
            expect(getTechLevel('strength')).toBe(2);
            expect(isTechUnlocked('swiftStrikes')).toBe(true);
        });

        it('returns false for unknown tech', () => {
            expect(isTechUnlocked('doesNotExist')).toBe(false);
        });

        it('returns false when tech is already at max level', () => {
            // autoStudy has maxLevel 1
            completeResearch('autoStudy', 1);
            expect(isTechUnlocked('autoStudy')).toBe(false);
        });

        it('handles altRequires (OR prerequisite) for bonusEnhance', () => {
            // bonusEnhance requires armorMastery L1 OR weaponMastery L1
            expect(isTechUnlocked('bonusEnhance')).toBe(false);

            // Satisfy only weaponMastery (altRequires path)
            completeResearch('weaponMastery', 1);
            expect(isTechUnlocked('bonusEnhance')).toBe(true);
        });

        it('handles altRequires — main requires path also works', () => {
            resetGame();
            // Satisfy only armorMastery (main requires path)
            completeResearch('armorMastery', 1);
            expect(isTechUnlocked('bonusEnhance')).toBe(true);
        });

        it('handles multi-prerequisite techs (AND logic)', () => {
            // waveBreaker requires vitality L2 AND strength L2
            expect(isTechUnlocked('waveBreaker')).toBe(false);

            completeResearch('vitality', 1);
            completeResearch('vitality', 2);
            expect(isTechUnlocked('waveBreaker')).toBe(false); // still need strength

            completeResearch('strength', 1);
            completeResearch('strength', 2);
            expect(isTechUnlocked('waveBreaker')).toBe(true);
        });
    });

    describe('isTechMaxed', () => {
        it('returns false for fresh tech', () => {
            expect(isTechMaxed('vitality')).toBe(false);
        });

        it('returns true when tech is at max level', () => {
            // autoStudy has maxLevel 1
            completeResearch('autoStudy', 1);
            expect(isTechMaxed('autoStudy')).toBe(true);
        });

        it('returns false for unknown tech', () => {
            expect(isTechMaxed('doesNotExist')).toBe(false);
        });

        it('returns false when partially leveled', () => {
            completeResearch('vitality', 3);
            expect(isTechMaxed('vitality')).toBe(false); // maxLevel is 5
        });
    });

    describe('getEffectiveResearchCost', () => {
        it('returns base cost without discount', () => {
            const baseCost = getResearchCost('vitality', 1);
            expect(getEffectiveResearchCost('vitality', 1)).toBe(baseCost);
        });

        it('applies essenceResonance discount', () => {
            // essenceResonance: -15% per level
            // Need to complete prereqs: goldRush L2 -> essenceStudy L2 -> essenceResonance L1
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('essenceStudy', 1);
            completeResearch('essenceStudy', 2);
            completeResearch('essenceResonance', 1);
            expect(getTechEffect('essenceResonance')).toBe(15);

            const baseCost = getResearchCost('vitality', 1);
            const expected = Math.max(1, Math.floor(baseCost * (1 - 15 / 100)));
            expect(getEffectiveResearchCost('vitality', 1)).toBe(expected);
        });

        it('never returns less than 1', () => {
            // Even with absurdly high discount, minimum cost is 1
            // (In practice essenceResonance caps at 3*15=45%)
            expect(getEffectiveResearchCost('goldRush', 1)).toBeGreaterThanOrEqual(1);
        });
    });

    describe('canStartResearch', () => {
        it('returns false if tech is locked', () => {
            expect(canStartResearch('swiftStrikes')).toBe(false);
        });

        it('returns false if not enough essence', () => {
            // vitality is unlocked but essence is 0
            expect(canStartResearch('vitality')).toBe(false);
        });

        it('returns true when unlocked and affordable', () => {
            addEssence(1000);
            expect(canStartResearch('vitality')).toBe(true);
        });

        it('returns false when tech is maxed', () => {
            addEssence(100000);
            completeResearch('autoStudy', 1);
            expect(canStartResearch('autoStudy')).toBe(false);
        });
    });

    describe('startResearch', () => {
        it('starts research when no active research', () => {
            addEssence(1000);
            const result = startResearch('vitality');
            expect(result).toBe(true);

            const state = getResearchState();
            expect(state.active).not.toBeNull();
            expect(state.active.techId).toBe('vitality');
            expect(state.active.level).toBe(1);
            expect(state.active.duration).toBe(150); // baseTime for vitality
        });

        it('spends essence on start', () => {
            addEssence(1000);
            const before = getEssence();
            startResearch('vitality');
            const cost = getResearchCost('vitality', 1);
            expect(getEssence()).toBe(before - cost);
        });

        it('returns false if tech is locked', () => {
            addEssence(10000);
            expect(startResearch('swiftStrikes')).toBe(false);
        });

        it('returns false if not enough essence', () => {
            expect(startResearch('vitality')).toBe(false);
        });

        it('returns false for unknown tech', () => {
            addEssence(10000);
            expect(startResearch('doesNotExist')).toBe(false);
        });

        it('returns false if already at max level', () => {
            addEssence(100000);
            completeResearch('autoStudy', 1);
            expect(startResearch('autoStudy')).toBe(false);
        });

        it('queues research if something is already active', () => {
            // Need researchQueue tech for queuing
            completeResearch('smartFilter', 1);
            completeResearch('researchQueue', 1);
            expect(getTechEffect('researchQueue')).toBe(1);

            addEssence(100000);
            startResearch('vitality'); // active
            const result = startResearch('strength'); // should queue
            expect(result).toBe(true);

            const queue = getResearchQueue();
            expect(queue).toHaveLength(1);
            expect(queue[0].techId).toBe('strength');
        });

        it('returns false if queue is full', () => {
            // researchQueue level 1 = 1 queue slot
            completeResearch('smartFilter', 1);
            completeResearch('researchQueue', 1);

            addEssence(100000);
            startResearch('vitality'); // active
            startResearch('strength'); // queue slot 1
            const result = startResearch('goldRush'); // queue full
            expect(result).toBe(false);
        });

        it('returns false if no research queue tech and something is active', () => {
            addEssence(100000);
            startResearch('vitality'); // active
            const result = startResearch('strength'); // no queue tech
            expect(result).toBe(false);
        });

        it('researches next level when tech is partially completed', () => {
            addEssence(100000);
            completeResearch('vitality', 1);
            startResearch('vitality'); // should start level 2
            const state = getResearchState();
            expect(state.active.level).toBe(2);
        });
    });

    describe('getResearchStatus', () => {
        it('returns null when no active research', () => {
            expect(getResearchStatus()).toBeNull();
        });

        it('returns progress info for active research', () => {
            addEssence(1000);
            startResearch('vitality');
            const status = getResearchStatus();
            expect(status).not.toBeNull();
            expect(status.techId).toBe('vitality');
            expect(status.level).toBe(1);
            expect(status.duration).toBe(150);
            expect(status.remaining).toBeLessThanOrEqual(150);
            expect(status.progress).toBeGreaterThanOrEqual(0);
            expect(status.speedUpCost).toBeGreaterThanOrEqual(0);
        });

        it('speedUpCost equals remaining * SPEED_UP_GOLD_PER_SECOND', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 100,
            });
            const status = getResearchStatus();
            expect(status.speedUpCost).toBe(Math.ceil(status.remaining * SPEED_UP_GOLD_PER_SECOND));
        });
    });

    describe('checkResearchComplete', () => {
        it('returns false when no active research', () => {
            expect(checkResearchComplete()).toBe(false);
        });

        it('returns false when research is still in progress', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 9999,
            });
            expect(checkResearchComplete()).toBe(false);
        });

        it('completes research when time has elapsed', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now() - 200_000, // 200s ago, duration was 150s
                duration: 150,
            });
            const result = checkResearchComplete();
            expect(result).toBe(true);
            expect(getTechLevel('vitality')).toBe(1);
            expect(getResearchState().active).toBeNull();
        });

        it('processes queue after completing research', () => {
            // Setup: queue with an entry
            completeResearch('smartFilter', 1);
            completeResearch('researchQueue', 1);

            addEssence(100000);
            startResearch('vitality'); // active
            startResearch('strength'); // queued

            // Force-complete vitality
            const state = getResearchState();
            state.active.startedAt = Date.now() - 200_000;
            checkResearchComplete();

            expect(getTechLevel('vitality')).toBe(1);
            // strength should now be active
            expect(getResearchState().active).not.toBeNull();
            expect(getResearchState().active.techId).toBe('strength');
        });
    });

    describe('speedUpResearch', () => {
        it('returns false when no active research', () => {
            const research = getResearchState();
            research.active = null;
            expect(speedUpResearch()).toBe(false);
        });

        it('returns false when not enough gold', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 100,
            });
            // Gold is 0
            expect(speedUpResearch()).toBe(false);
        });

        it('completes research instantly when enough gold', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 100,
            });
            addGold(10000);
            const result = speedUpResearch();
            expect(result).toBe(true);
            expect(getTechLevel('vitality')).toBe(1);
            expect(getResearchState().active).toBeNull();
        });

        it('deducts gold equal to speedUpCost', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 100,
            });
            addGold(50000);
            const goldBefore = getGold();
            const status = getResearchStatus();
            speedUpResearch();
            expect(getGold()).toBe(goldBefore - status.speedUpCost);
        });

        it('auto-completes if research already done', () => {
            setResearchActive({
                techId: 'strength',
                level: 1,
                startedAt: Date.now() - 200_000,
                duration: 150,
            });
            const result = speedUpResearch();
            expect(result).toBe(true);
            expect(getTechLevel('strength')).toBe(1);
        });
    });

    describe('initResearch (offline completion)', () => {
        it('completes research that finished while offline', () => {
            // Simulate: research was started 10 minutes ago, duration was 150s
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now() - 600_000,
                duration: 150,
            });
            initResearch();
            expect(getTechLevel('vitality')).toBe(1);
            expect(getResearchState().active).toBeNull();
        });

        it('resumes timer for in-progress research', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 9999,
            });
            initResearch();
            // Research should still be active (not completed)
            expect(getResearchState().active).not.toBeNull();
            expect(getResearchState().active.techId).toBe('vitality');
            stopResearchTimer(); // cleanup
        });

        it('processes queue items after offline completion', () => {
            completeResearch('smartFilter', 1);
            completeResearch('researchQueue', 1);

            // Simulate: active research completed offline, queue has next item
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now() - 600_000,
                duration: 150,
            });
            addToResearchQueue({ techId: 'strength', level: 1, duration: 150 });

            initResearch();
            expect(getTechLevel('vitality')).toBe(1);
            // strength should now be active from queue
            expect(getResearchState().active).not.toBeNull();
            expect(getResearchState().active.techId).toBe('strength');
            stopResearchTimer(); // cleanup
        });
    });

    describe('research queue management', () => {
        it('addToResearchQueue adds to queue', () => {
            addToResearchQueue({ techId: 'vitality', level: 1, duration: 150 });
            expect(getResearchQueue()).toHaveLength(1);
            expect(getResearchQueue()[0].techId).toBe('vitality');
        });

        it('shiftResearchQueue removes first item', () => {
            addToResearchQueue({ techId: 'vitality', level: 1, duration: 150 });
            addToResearchQueue({ techId: 'strength', level: 1, duration: 150 });
            const first = shiftResearchQueue();
            expect(first.techId).toBe('vitality');
            expect(getResearchQueue()).toHaveLength(1);
        });

        it('shiftResearchQueue returns null on empty queue', () => {
            expect(shiftResearchQueue()).toBeNull();
        });
    });
});
