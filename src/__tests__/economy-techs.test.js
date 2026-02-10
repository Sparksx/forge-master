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
    resetGame, completeResearch, getTechEffect, getSellValue,
    getStudyValue, addEssence, getEssence, getGold, addGold,
} = await import('../state.js');
const { getEffectiveResearchCost } = await import('../research.js');
const { getResearchCost } = await import('../tech-config.js');

describe('economy tech effects', () => {

    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    describe('goldRush', () => {
        it('returns 0 at level 0', () => {
            expect(getTechEffect('goldRush')).toBe(0);
        });

        it('increases sell value by +20% per level', () => {
            const item = { level: 50, tier: 3 };
            const baseValue = 50 * 3; // 150

            expect(getSellValue(item)).toBe(baseValue);

            completeResearch('goldRush', 1);
            expect(getSellValue(item)).toBe(Math.floor(baseValue * 1.2));

            completeResearch('goldRush', 2);
            expect(getSellValue(item)).toBe(Math.floor(baseValue * 1.4));

            completeResearch('goldRush', 3);
            expect(getSellValue(item)).toBe(Math.floor(baseValue * 1.6));
        });

        it('max goldRush (level 5) gives +100% sell value', () => {
            completeResearch('goldRush', 5);
            expect(getTechEffect('goldRush')).toBe(100);
            const item = { level: 100, tier: 1 };
            expect(getSellValue(item)).toBe(200); // 100 * 2
        });
    });

    describe('essenceStudy', () => {
        it('returns 0 at level 0', () => {
            expect(getTechEffect('essenceStudy')).toBe(0);
        });

        it('increases by +25% per level', () => {
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('essenceStudy', 1);
            expect(getTechEffect('essenceStudy')).toBe(25);

            completeResearch('essenceStudy', 2);
            expect(getTechEffect('essenceStudy')).toBe(50);

            completeResearch('essenceStudy', 3);
            expect(getTechEffect('essenceStudy')).toBe(75);
        });

        it('study value base calculation is level * tier²', () => {
            // The base study value is calculated in state.getStudyValue
            // essenceStudy bonus is applied in UI layer (forge-ui.js studyForgedItem)
            // Here we verify the base value computation
            expect(getStudyValue({ level: 30, tier: 4 })).toBe(30 * 16); // 480
        });
    });

    describe('treasureHunter', () => {
        it('returns 0 at level 0', () => {
            expect(getTechEffect('treasureHunter')).toBe(0);
        });

        it('gives 10% chance per level', () => {
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('goldRush', 3);
            completeResearch('treasureHunter', 1);
            expect(getTechEffect('treasureHunter')).toBe(10);
        });

        it('stacks to 30% at max level', () => {
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('goldRush', 3);
            completeResearch('treasureHunter', 1);
            completeResearch('treasureHunter', 2);
            completeResearch('treasureHunter', 3);
            expect(getTechEffect('treasureHunter')).toBe(30);
        });
    });

    describe('essenceResonance', () => {
        it('returns 0 at level 0', () => {
            expect(getTechEffect('essenceResonance')).toBe(0);
        });

        it('reduces research cost by -15% per level', () => {
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('essenceStudy', 1);
            completeResearch('essenceStudy', 2);
            completeResearch('essenceResonance', 1);
            expect(getTechEffect('essenceResonance')).toBe(15);

            const baseCost = getResearchCost('vitality', 1);
            const effective = getEffectiveResearchCost('vitality', 1);
            expect(effective).toBe(Math.max(1, Math.floor(baseCost * 0.85)));
        });

        it('stacks to -45% at max level', () => {
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('essenceStudy', 1);
            completeResearch('essenceStudy', 2);
            completeResearch('essenceResonance', 1);
            completeResearch('essenceResonance', 2);
            completeResearch('essenceResonance', 3);
            expect(getTechEffect('essenceResonance')).toBe(45);

            const baseCost = getResearchCost('vitality', 1);
            const effective = getEffectiveResearchCost('vitality', 1);
            expect(effective).toBe(Math.max(1, Math.floor(baseCost * 0.55)));
        });

        it('discount applies to all research costs', () => {
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('essenceStudy', 1);
            completeResearch('essenceStudy', 2);
            completeResearch('essenceResonance', 1);

            // Check discount on different techs and levels
            const vitCost1 = getResearchCost('vitality', 1);
            const vitEffective1 = getEffectiveResearchCost('vitality', 1);
            expect(vitEffective1).toBe(Math.max(1, Math.floor(vitCost1 * 0.85)));

            const strCost3 = getResearchCost('strength', 3);
            const strEffective3 = getEffectiveResearchCost('strength', 3);
            expect(strEffective3).toBe(Math.max(1, Math.floor(strCost3 * 0.85)));
        });
    });

    describe('doubleHarvest', () => {
        it('returns 0 at level 0', () => {
            expect(getTechEffect('doubleHarvest')).toBe(0);
        });

        it('gives 5% at level 1 (max level)', () => {
            // Double harvest requires essenceResonance L2 and treasureHunter L2
            completeResearch('goldRush', 1);
            completeResearch('goldRush', 2);
            completeResearch('goldRush', 3);
            completeResearch('essenceStudy', 1);
            completeResearch('essenceStudy', 2);
            completeResearch('essenceResonance', 1);
            completeResearch('essenceResonance', 2);
            completeResearch('treasureHunter', 1);
            completeResearch('treasureHunter', 2);
            completeResearch('doubleHarvest', 1);
            expect(getTechEffect('doubleHarvest')).toBe(5);
        });
    });

    describe('automation techs', () => {
        it('smartFilter returns level count', () => {
            completeResearch('smartFilter', 1);
            expect(getTechEffect('smartFilter')).toBe(1);
            completeResearch('smartFilter', 2);
            expect(getTechEffect('smartFilter')).toBe(2);
        });

        it('autoEquip returns 1 when researched', () => {
            completeResearch('smartFilter', 1);
            completeResearch('smartFilter', 2);
            completeResearch('autoEquip', 1);
            expect(getTechEffect('autoEquip')).toBe(1);
        });

        it('autoStudy returns 1 when researched', () => {
            completeResearch('autoStudy', 1);
            expect(getTechEffect('autoStudy')).toBe(1);
        });

        it('researchQueue returns queue size', () => {
            completeResearch('smartFilter', 1);
            completeResearch('researchQueue', 1);
            expect(getTechEffect('researchQueue')).toBe(1);
            completeResearch('researchQueue', 2);
            expect(getTechEffect('researchQueue')).toBe(2);
            completeResearch('researchQueue', 3);
            expect(getTechEffect('researchQueue')).toBe(3);
        });

        it('quickForge returns -15% per level', () => {
            completeResearch('forgeMultiple', 1);
            completeResearch('quickForge', 1);
            expect(getTechEffect('quickForge')).toBe(15);
            completeResearch('quickForge', 2);
            expect(getTechEffect('quickForge')).toBe(30);
            completeResearch('quickForge', 3);
            expect(getTechEffect('quickForge')).toBe(45);
        });

        it('forgeMultiple returns +1 per level', () => {
            completeResearch('forgeMultiple', 1);
            expect(getTechEffect('forgeMultiple')).toBe(1);
            completeResearch('forgeMultiple', 5);
            expect(getTechEffect('forgeMultiple')).toBe(5);
        });

        it('selectiveForge returns level', () => {
            completeResearch('forgeMultiple', 1);
            completeResearch('forgeMultiple', 2);
            completeResearch('forgeMultiple', 3);
            completeResearch('selectiveForge', 1);
            expect(getTechEffect('selectiveForge')).toBe(1);
            completeResearch('selectiveForge', 2);
            expect(getTechEffect('selectiveForge')).toBe(2);
        });
    });

    describe('combined tech effects', () => {
        it('goldRush and essenceResonance stack independently', () => {
            completeResearch('goldRush', 3);
            completeResearch('goldRush', 2); // Overwritten by completeResearch logic? No, completeResearch sets level directly
            // Actually completeResearch(id, level) sets completed[id] = level
            // Let's reset and be explicit
            resetGame();

            completeResearch('goldRush', 3);
            expect(getTechEffect('goldRush')).toBe(60);

            completeResearch('essenceStudy', 2);
            completeResearch('essenceResonance', 1);
            expect(getTechEffect('essenceResonance')).toBe(15);

            // Both effects work independently
            const item = { level: 50, tier: 2 };
            const sellValue = getSellValue(item);
            const baseSell = 50 * 2;
            expect(sellValue).toBe(Math.floor(baseSell * 1.6));

            const researchCost = getEffectiveResearchCost('vitality', 1);
            const baseCost = getResearchCost('vitality', 1);
            expect(researchCost).toBe(Math.max(1, Math.floor(baseCost * 0.85)));
        });

        it('all economy techs can be active simultaneously', () => {
            completeResearch('goldRush', 5);
            completeResearch('essenceStudy', 3);
            completeResearch('treasureHunter', 3);
            completeResearch('essenceResonance', 3);
            completeResearch('doubleHarvest', 1);

            expect(getTechEffect('goldRush')).toBe(100);
            expect(getTechEffect('essenceStudy')).toBe(75);
            expect(getTechEffect('treasureHunter')).toBe(30);
            expect(getTechEffect('essenceResonance')).toBe(45);
            expect(getTechEffect('doubleHarvest')).toBe(5);
        });
    });
});
