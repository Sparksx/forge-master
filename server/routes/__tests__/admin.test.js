import { describe, it, expect } from 'vitest';
import { parseDuration } from '../admin.js';

describe('parseDuration', () => {
    describe('minutes', () => {
        it('converts "30m" to 1800000 ms', () => {
            expect(parseDuration('30m')).toBe(1_800_000);
        });

        it('converts "1m" to 60000 ms', () => {
            expect(parseDuration('1m')).toBe(60_000);
        });
    });

    describe('hours', () => {
        it('converts "1h" to 3600000 ms', () => {
            expect(parseDuration('1h')).toBe(3_600_000);
        });

        it('converts "24h" to 86400000 ms', () => {
            expect(parseDuration('24h')).toBe(86_400_000);
        });
    });

    describe('days', () => {
        it('converts "7d" to 604800000 ms', () => {
            expect(parseDuration('7d')).toBe(604_800_000);
        });

        it('converts "1d" to 86400000 ms', () => {
            expect(parseDuration('1d')).toBe(86_400_000);
        });
    });

    describe('invalid inputs', () => {
        it('returns null for null', () => {
            expect(parseDuration(null)).toBeNull();
        });

        it('returns null for undefined', () => {
            expect(parseDuration(undefined)).toBeNull();
        });

        it('returns null for empty string', () => {
            expect(parseDuration('')).toBeNull();
        });

        it('returns null for "abc"', () => {
            expect(parseDuration('abc')).toBeNull();
        });

        it('returns null for unsupported unit "30x"', () => {
            expect(parseDuration('30x')).toBeNull();
        });

        it('returns null for bare number "30"', () => {
            expect(parseDuration('30')).toBeNull();
        });

        it('returns null for bare unit "m"', () => {
            expect(parseDuration('m')).toBeNull();
        });

        it('returns null for negative value "-5m"', () => {
            expect(parseDuration('-5m')).toBeNull();
        });

        it('returns null for decimal value "1.5h"', () => {
            expect(parseDuration('1.5h')).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('converts "0m" to 0', () => {
            expect(parseDuration('0m')).toBe(0);
        });
    });
});
