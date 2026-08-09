import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test.
const mockGetMyClanCached = vi.fn(() => null);
const mockListMissions = vi.fn(async () => ({ missions: [] }));
const mockReportMissionProgress = vi.fn(async () => ({}));
const mockRefreshMyClan = vi.fn(async () => {});

vi.mock('../clan.js', () => ({
    getMyClanCached: (...args) => mockGetMyClanCached(...args),
    listMissions: (...args) => mockListMissions(...args),
    reportMissionProgress: (...args) => mockReportMissionProgress(...args),
    refreshMyClan: (...args) => mockRefreshMyClan(...args),
}));

vi.mock('../config.js', () => ({
    EQUIPMENT_TYPES: ['weapon', 'armor', 'hat', 'gloves', 'boots', 'belt', 'necklace', 'ring'],
    rankKind: vi.fn((rank) => {
        if (rank % 50 === 0) return 'bigboss';
        if (rank % 10 === 0) return 'boss';
        return 'normal';
    }),
}));

vi.mock('../../../shared/clan-activities.js', () => ({
    MISSION_PROGRESS_MAX_PER_REPORT: 50,
}));

import { gameEvents, EVENTS } from '../../events.js';
import { initClanMissions } from '../clan-missions.js';

describe('clan-missions tracker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockGetMyClanCached.mockReturnValue(null);
        initClanMissions();
        // Reset the internal lastTypeFetch so refreshActiveTypes actually queries.
        gameEvents.emit(EVENTS.CLAN_CHANGED);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ---------------------------------------------------------------------------
    // Event→bump wiring
    // ---------------------------------------------------------------------------
    describe('event wiring', () => {
        it('does not flush when player is not in a clan', () => {
            mockGetMyClanCached.mockReturnValue(null);
            gameEvents.emit(EVENTS.ITEM_FORGED);
            vi.advanceTimersByTime(10000);
            expect(mockReportMissionProgress).not.toHaveBeenCalled();
        });

        it('accumulates forge_count on ITEM_FORGED', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'forge_count', status: 'active' }],
            });

            gameEvents.emit(EVENTS.ITEM_FORGED);
            gameEvents.emit(EVENTS.ITEM_FORGED);
            gameEvents.emit(EVENTS.ITEM_FORGED);

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockReportMissionProgress).toHaveBeenCalledWith('forge_count', 3);
        });

        it('accumulates defeat_enemies on COMBAT_MONSTER_DEFEATED', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'defeat_enemies', status: 'active' }],
            });

            gameEvents.emit(EVENTS.COMBAT_MONSTER_DEFEATED);

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockReportMissionProgress).toHaveBeenCalledWith('defeat_enemies', 1);
        });

        it('bumps win_bosses only for boss arena wins', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [
                    { type: 'win_bosses', status: 'active' },
                    { type: 'reach_arena', status: 'active' },
                ],
            });

            gameEvents.emit(EVENTS.ARENA_RESULT, { win: true, rank: 10 });
            gameEvents.emit(EVENTS.ARENA_RESULT, { win: true, rank: 3 });
            gameEvents.emit(EVENTS.ARENA_RESULT, { win: false, rank: 20 });

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockReportMissionProgress).toHaveBeenCalledWith('win_bosses', 1);
            expect(mockReportMissionProgress).toHaveBeenCalledWith('reach_arena', 2);
        });

        it('does not bump on arena loss', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'reach_arena', status: 'active' }],
            });

            gameEvents.emit(EVENTS.ARENA_RESULT, { win: false, rank: 5 });

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockReportMissionProgress).not.toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------------------
    // Full-gear-swap detection
    // ---------------------------------------------------------------------------
    describe('swap_all_gear detection', () => {
        it('triggers after equipping all 8 slot types', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'swap_all_gear', status: 'active' }],
            });

            const types = ['weapon', 'armor', 'hat', 'gloves', 'boots', 'belt', 'necklace', 'ring'];
            for (const type of types) {
                gameEvents.emit(EVENTS.ITEM_EQUIPPED, { type });
            }

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockReportMissionProgress).toHaveBeenCalledWith('swap_all_gear', 1);
        });

        it('does not trigger with only 7 of 8 slots equipped', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'swap_all_gear', status: 'active' }],
            });

            const partial = ['weapon', 'armor', 'hat', 'gloves', 'boots', 'belt', 'necklace'];
            for (const type of partial) {
                gameEvents.emit(EVENTS.ITEM_EQUIPPED, { type });
            }

            await vi.advanceTimersByTimeAsync(10000);

            const swapCalls = mockReportMissionProgress.mock.calls.filter(
                ([t]) => t === 'swap_all_gear'
            );
            expect(swapCalls).toHaveLength(0);
        });

        it('ignores equip events with no type', () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            gameEvents.emit(EVENTS.ITEM_EQUIPPED, null);
            gameEvents.emit(EVENTS.ITEM_EQUIPPED, {});
            gameEvents.emit(EVENTS.ITEM_EQUIPPED, undefined);
        });
    });

    // ---------------------------------------------------------------------------
    // Flush behavior
    // ---------------------------------------------------------------------------
    describe('flush debouncing', () => {
        it('drops pending progress for inactive mission types', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'forge_count', status: 'completed' }],
            });

            gameEvents.emit(EVENTS.ITEM_FORGED);

            await vi.advanceTimersByTimeAsync(10000);

            const forgeCalls = mockReportMissionProgress.mock.calls.filter(
                ([t]) => t === 'forge_count'
            );
            expect(forgeCalls).toHaveLength(0);
        });

        it('refreshes clan perks when a mission completes', async () => {
            mockGetMyClanCached.mockReturnValue({ id: 1 });
            mockListMissions.mockResolvedValue({
                missions: [{ type: 'forge_count', status: 'active' }],
            });
            mockReportMissionProgress.mockResolvedValue({
                completed: [{ type: 'forge_count' }],
            });

            gameEvents.emit(EVENTS.ITEM_FORGED);

            await vi.advanceTimersByTimeAsync(10000);

            expect(mockRefreshMyClan).toHaveBeenCalled();
        });
    });
});
