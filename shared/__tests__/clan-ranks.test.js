import { describe, it, expect } from 'vitest';
import { RANKS, can, rankOrder, rankInfo, nextRankUp, nextRankDown, ASSIGNABLE_RANKS } from '../clan-ranks.js';

describe('clan ranks', () => {
    it('orders owner > coleader > officer > member', () => {
        expect(rankOrder('owner')).toBeGreaterThan(rankOrder('coleader'));
        expect(rankOrder('coleader')).toBeGreaterThan(rankOrder('officer'));
        expect(rankOrder('officer')).toBeGreaterThan(rankOrder('member'));
    });

    it('falls back to member for unknown keys', () => {
        expect(rankOrder('bogus')).toBe(rankOrder('member'));
        expect(rankInfo('bogus').key).toBe('member');
    });

    it('exposes exactly four ranks and three assignable', () => {
        expect(RANKS).toHaveLength(4);
        expect(ASSIGNABLE_RANKS).toEqual(['coleader', 'officer', 'member']);
    });

    it('ladder steps are consistent', () => {
        expect(nextRankUp('member')).toBe('officer');
        expect(nextRankUp('officer')).toBe('coleader');
        expect(nextRankUp('coleader')).toBe(null);
        expect(nextRankDown('coleader')).toBe('officer');
        expect(nextRankDown('officer')).toBe('member');
        expect(nextRankDown('member')).toBe(null);
    });
});

describe('clan permissions', () => {
    it('lets a member manage no one', () => {
        expect(can('member', 'kick', 'member')).toBe(false);
        expect(can('member', 'promote', 'member')).toBe(false);
        expect(can('member', 'startActivity')).toBe(false);
    });

    it('lets officers start activities but not manage peers', () => {
        expect(can('officer', 'startActivity')).toBe(true);
        expect(can('officer', 'kick', 'member')).toBe(true);
        expect(can('officer', 'kick', 'officer')).toBe(false); // not strictly lower
        expect(can('officer', 'kick', 'coleader')).toBe(false);
    });

    it('lets the owner do everything within reason', () => {
        expect(can('owner', 'startActivity')).toBe(true);
        expect(can('owner', 'editClan')).toBe(true);
        expect(can('owner', 'transfer')).toBe(true);
        expect(can('owner', 'disband')).toBe(true);
        expect(can('owner', 'kick', 'coleader')).toBe(true);
        expect(can('owner', 'promote', 'officer')).toBe(true);
    });

    it('forbids acting on equal or higher ranks', () => {
        expect(can('coleader', 'kick', 'owner')).toBe(false);
        expect(can('coleader', 'demote', 'coleader')).toBe(false);
        expect(can('coleader', 'promote', 'officer')).toBe(true);
    });

    it('reserves transfer/disband for the owner only', () => {
        expect(can('coleader', 'transfer')).toBe(false);
        expect(can('coleader', 'disband')).toBe(false);
    });

    it('rejects unknown actions', () => {
        expect(can('owner', 'frobnicate')).toBe(false);
    });
});
