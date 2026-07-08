import { describe, it, expect } from 'vitest';
import { fmt } from '../components.js';

describe('fmt', () => {
    describe('small numbers (below 10k)', () => {
        it('formats 0', () => {
            expect(fmt(0)).toBe('0');
        });

        it('formats 1', () => {
            expect(fmt(1)).toBe('1');
        });

        it('formats 999', () => {
            expect(fmt(999)).toBe('999');
        });

        it('formats 1234 with comma', () => {
            expect(fmt(1234)).toBe('1,234');
        });

        it('formats 9999 with comma', () => {
            expect(fmt(9999)).toBe('9,999');
        });
    });

    describe('k range (10k to 999k)', () => {
        it('formats 10000 as 10k', () => {
            expect(fmt(10000)).toBe('10k');
        });

        it('formats 12345 as 12.3k', () => {
            expect(fmt(12345)).toBe('12.3k');
        });

        it('formats 99999 as 100k', () => {
            expect(fmt(99999)).toBe('100k');
        });

        it('formats 500000 as 500k', () => {
            expect(fmt(500000)).toBe('500k');
        });
    });

    describe('M range (1M to 999M)', () => {
        it('formats 1000000 as 1M', () => {
            expect(fmt(1000000)).toBe('1M');
        });

        it('formats 1234567 as 1.23M', () => {
            expect(fmt(1234567)).toBe('1.23M');
        });

        it('formats 12500000 as 12.50M', () => {
            expect(fmt(12500000)).toBe('12.50M');
        });

        it('keeps single trailing zero: 1200000 -> 1.20M', () => {
            expect(fmt(1200000)).toBe('1.20M');
        });

        it('strips all decimal zeros: 2000000 -> 2M', () => {
            expect(fmt(2000000)).toBe('2M');
        });
    });

    describe('B range (1B+)', () => {
        it('formats 1000000000 as 1B', () => {
            expect(fmt(1000000000)).toBe('1B');
        });

        it('formats 1234567890 as 1.23B', () => {
            expect(fmt(1234567890)).toBe('1.23B');
        });

        it('keeps single trailing zero: 1500000000 -> 1.50B', () => {
            expect(fmt(1500000000)).toBe('1.50B');
        });

        it('strips all decimal zeros: 3000000000 -> 3B', () => {
            expect(fmt(3000000000)).toBe('3B');
        });
    });

    describe('edge cases', () => {
        it('treats null as 0', () => {
            expect(fmt(null)).toBe('0');
        });

        it('treats undefined as 0', () => {
            expect(fmt(undefined)).toBe('0');
        });

        it('treats NaN as 0', () => {
            expect(fmt(NaN)).toBe('0');
        });
    });

    describe('negative numbers', () => {
        it('formats -50000 as -50k', () => {
            expect(fmt(-50000)).toBe('-50k');
        });

        it('formats -1234567 as -1.23M', () => {
            expect(fmt(-1234567)).toBe('-1.23M');
        });

        it('formats -2000000000 as -2B', () => {
            expect(fmt(-2000000000)).toBe('-2B');
        });

        it('formats small negative as locale string', () => {
            expect(fmt(-999)).toBe('-999');
        });
    });
});
