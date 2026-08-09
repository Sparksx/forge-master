import { describe, it, expect } from 'vitest';
import {
    PVP_BASE_POWER_RANGE,
    PVP_POWER_RANGE_EXPANSION,
    PVP_RANGE_INTERVAL,
    PVP_TURN_TIMEOUT,
} from '../pvp-config.js';

describe('PvP config constants', () => {
    it('base power range is a positive fraction', () => {
        expect(PVP_BASE_POWER_RANGE).toBeGreaterThan(0);
        expect(PVP_BASE_POWER_RANGE).toBeLessThanOrEqual(1);
    });

    it('power range expansion is positive and smaller than base range', () => {
        expect(PVP_POWER_RANGE_EXPANSION).toBeGreaterThan(0);
        expect(PVP_POWER_RANGE_EXPANSION).toBeLessThanOrEqual(PVP_BASE_POWER_RANGE);
    });

    it('range interval is a positive duration in ms', () => {
        expect(Number.isInteger(PVP_RANGE_INTERVAL)).toBe(true);
        expect(PVP_RANGE_INTERVAL).toBeGreaterThan(0);
    });

    it('turn timeout is a positive duration in ms', () => {
        expect(Number.isInteger(PVP_TURN_TIMEOUT)).toBe(true);
        expect(PVP_TURN_TIMEOUT).toBeGreaterThan(0);
    });

    it('turn timeout is long enough for player decision (>= 5s)', () => {
        expect(PVP_TURN_TIMEOUT).toBeGreaterThanOrEqual(5000);
    });

    it('matchmaking widens over time: base + N expansions grows', () => {
        const afterThreeIntervals = PVP_BASE_POWER_RANGE + 3 * PVP_POWER_RANGE_EXPANSION;
        expect(afterThreeIntervals).toBeGreaterThan(PVP_BASE_POWER_RANGE);
    });
});
