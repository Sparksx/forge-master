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
    resetGame, getEssence, addEssence, spendEssence, getStudyValue,
    getTechLevel, getTechEffect, getResearchState, setResearchActive,
    completeResearch, getResearchQueue, addToResearchQueue, shiftResearchQueue,
    getSellValue, loadGame, saveGame,
} = await import('../state.js');

const { SAVE_KEY } = await import('../config.js');

describe('state — essence & research', () => {

    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    describe('essence management', () => {
        it('starts at 0', () => {
            expect(getEssence()).toBe(0);
        });

        it('addEssence increases essence', () => {
            addEssence(100);
            expect(getEssence()).toBe(100);
        });

        it('addEssence accumulates', () => {
            addEssence(50);
            addEssence(30);
            expect(getEssence()).toBe(80);
        });

        it('spendEssence returns true and deducts when sufficient', () => {
            addEssence(200);
            expect(spendEssence(150)).toBe(true);
            expect(getEssence()).toBe(50);
        });

        it('spendEssence returns false when insufficient', () => {
            addEssence(10);
            expect(spendEssence(50)).toBe(false);
            expect(getEssence()).toBe(10);
        });

        it('spendEssence returns false when spending more than available', () => {
            expect(spendEssence(1)).toBe(false);
            expect(getEssence()).toBe(0);
        });
    });

    describe('getStudyValue', () => {
        it('calculates value as level * tier * tier', () => {
            expect(getStudyValue({ level: 10, tier: 1 })).toBe(10);
            expect(getStudyValue({ level: 10, tier: 2 })).toBe(40);
            expect(getStudyValue({ level: 10, tier: 3 })).toBe(90);
            expect(getStudyValue({ level: 50, tier: 1 })).toBe(50);
            expect(getStudyValue({ level: 50, tier: 3 })).toBe(450);
        });

        it('defaults tier to 1 when undefined', () => {
            expect(getStudyValue({ level: 20 })).toBe(20);
        });

        it('tier² scaling creates strategic value', () => {
            const t1 = getStudyValue({ level: 50, tier: 1 }); // 50
            const t3 = getStudyValue({ level: 50, tier: 3 }); // 450
            const t6 = getStudyValue({ level: 50, tier: 6 }); // 1800
            expect(t3).toBeGreaterThan(t1 * 3); // more than 3x
            expect(t6).toBeGreaterThan(t3 * 3); // more than 3x
        });
    });

    describe('getTechLevel', () => {
        it('returns 0 for unresearched tech', () => {
            expect(getTechLevel('vitality')).toBe(0);
        });

        it('returns completed level', () => {
            completeResearch('vitality', 3);
            expect(getTechLevel('vitality')).toBe(3);
        });

        it('returns 0 for unknown tech', () => {
            expect(getTechLevel('doesNotExist')).toBe(0);
        });
    });

    describe('getTechEffect', () => {
        it('returns 0 when no tech is researched', () => {
            expect(getTechEffect('vitality')).toBe(0);
            expect(getTechEffect('goldRush')).toBe(0);
        });

        it('returns perLevel * level for researched tech', () => {
            completeResearch('vitality', 3);
            // vitality: perLevel = 2, so 3 * 2 = 6
            expect(getTechEffect('vitality')).toBe(6);
        });

        it('returns cumulative effect for multi-level tech', () => {
            completeResearch('goldRush', 5);
            // goldRush: perLevel = 2, so 5 * 2 = 10
            expect(getTechEffect('goldRush')).toBe(10);
        });

        it('returns 0 for non-existent effect type', () => {
            expect(getTechEffect('doesNotExist')).toBe(0);
        });

        it('aggregates across all techs with same effect type', () => {
            // Each tech has a unique effect type in this design,
            // so this test verifies single-tech aggregation
            completeResearch('strength', 2);
            expect(getTechEffect('strength')).toBe(4); // 2 * 2
        });
    });

    describe('research state management', () => {
        it('starts with no active research', () => {
            const state = getResearchState();
            expect(state.active).toBeNull();
            expect(state.completed).toEqual({});
            expect(state.queue).toEqual([]);
        });

        it('setResearchActive sets active research', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 150,
            });
            const state = getResearchState();
            expect(state.active).not.toBeNull();
            expect(state.active.techId).toBe('vitality');
        });

        it('completeResearch updates completed and clears active', () => {
            setResearchActive({
                techId: 'vitality',
                level: 1,
                startedAt: Date.now(),
                duration: 150,
            });
            completeResearch('vitality', 1);
            const state = getResearchState();
            expect(state.active).toBeNull();
            expect(state.completed.vitality).toBe(1);
        });

        it('queue operations work correctly', () => {
            addToResearchQueue({ techId: 'vitality', level: 1, duration: 150 });
            addToResearchQueue({ techId: 'strength', level: 1, duration: 150 });
            expect(getResearchQueue()).toHaveLength(2);

            const first = shiftResearchQueue();
            expect(first.techId).toBe('vitality');
            expect(getResearchQueue()).toHaveLength(1);
        });
    });

    describe('getSellValue with goldRush tech', () => {
        it('returns base sell value without tech', () => {
            const item = { level: 10, tier: 2 };
            expect(getSellValue(item)).toBe(20); // 10 * 2
        });

        it('applies goldRush bonus to sell value', () => {
            completeResearch('goldRush', 3);
            // goldRush: +2% per level -> 6% bonus
            const item = { level: 10, tier: 2 };
            const base = 20; // 10 * 2
            const expected = Math.floor(base * (1 + 6 / 100));
            expect(getSellValue(item)).toBe(expected);
        });

        it('max goldRush (level 25) gives +50% sell value', () => {
            completeResearch('goldRush', 25);
            // goldRush: +2% * 25 = +50%
            const item = { level: 10, tier: 1 };
            const base = 10;
            expect(getSellValue(item)).toBe(Math.floor(base * 1.5));
        });
    });

    describe('save/load with research state', () => {
        it('saves essence and research to localStorage', () => {
            addEssence(500);
            completeResearch('vitality', 2);
            saveGame();

            const saved = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)[1]);
            expect(saved.essence).toBe(500);
            expect(saved.research).toBeDefined();
            expect(saved.research.completed.vitality).toBe(2);
        });

        it('loads essence from localStorage', () => {
            const data = {
                equipment: {},
                gold: 100,
                forgeLevel: 1,
                essence: 750,
                research: {
                    completed: { strength: 3 },
                    active: null,
                    queue: [],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            expect(getEssence()).toBe(750);
            expect(getTechLevel('strength')).toBe(3);
        });

        it('loads research completed state correctly', () => {
            const data = {
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                essence: 0,
                research: {
                    completed: {
                        vitality: 5,
                        strength: 3,
                        goldRush: 2,
                    },
                    active: null,
                    queue: [],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            expect(getTechLevel('vitality')).toBe(5);
            expect(getTechLevel('strength')).toBe(3);
            expect(getTechLevel('goldRush')).toBe(2);
        });

        it('ignores invalid tech ids in saved data', () => {
            const data = {
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                essence: 0,
                research: {
                    completed: {
                        vitality: 2,
                        invalidTech: 5,
                    },
                    active: null,
                    queue: [],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            expect(getTechLevel('vitality')).toBe(2);
            expect(getTechLevel('invalidTech')).toBe(0);
        });

        it('clamps tech level to maxLevel', () => {
            const data = {
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                essence: 0,
                research: {
                    completed: {
                        autoStudy: 99, // maxLevel is 1
                    },
                    active: null,
                    queue: [],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            // Should not load because 99 > maxLevel 1
            expect(getTechLevel('autoStudy')).toBe(0);
        });

        it('completes research that finished offline during load', () => {
            const data = {
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                essence: 0,
                research: {
                    completed: {},
                    active: {
                        techId: 'vitality',
                        level: 1,
                        startedAt: Date.now() - 600_000, // 10 min ago
                        duration: 150, // 2.5 min
                    },
                    queue: [],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            // Research should be auto-completed
            expect(getTechLevel('vitality')).toBe(1);
            expect(getResearchState().active).toBeNull();
        });

        it('preserves in-progress research during load', () => {
            const now = Date.now();
            const data = {
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                essence: 0,
                research: {
                    completed: {},
                    active: {
                        techId: 'vitality',
                        level: 1,
                        startedAt: now - 10_000, // 10s ago
                        duration: 150, // still has 140s left
                    },
                    queue: [],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            // Research should still be active
            expect(getResearchState().active).not.toBeNull();
            expect(getResearchState().active.techId).toBe('vitality');
            expect(getTechLevel('vitality')).toBe(0); // not yet completed
        });

        it('loads research queue', () => {
            const data = {
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                essence: 0,
                research: {
                    completed: {},
                    active: null,
                    queue: [
                        { techId: 'vitality', level: 1 },
                        { techId: 'strength', level: 1 },
                    ],
                },
            };
            localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
            loadGame();

            const queue = getResearchQueue();
            expect(queue).toHaveLength(2);
            expect(queue[0].techId).toBe('vitality');
        });

        it('resetGame clears essence and research', () => {
            addEssence(500);
            completeResearch('vitality', 3);
            addToResearchQueue({ techId: 'strength', level: 1, duration: 150 });

            resetGame();

            expect(getEssence()).toBe(0);
            expect(getTechLevel('vitality')).toBe(0);
            expect(getResearchState().active).toBeNull();
            expect(getResearchQueue()).toHaveLength(0);
        });
    });
});
