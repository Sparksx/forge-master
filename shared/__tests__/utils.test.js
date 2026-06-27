import { describe, it, expect } from 'vitest';
import { clampInt, pickBySeed, randomItem, randomInt } from '../utils.js';

describe('clampInt', () => {
    it('floors and clamps within range', () => {
        expect(clampInt(5.9, 0, 10)).toBe(5);
        expect(clampInt(-3, 0, 10)).toBe(0);
        expect(clampInt(99, 0, 10)).toBe(10);
    });
    it('returns min for non-finite / junk input', () => {
        expect(clampInt(NaN, 2, 10)).toBe(2);
        expect(clampInt('nope', 2, 10)).toBe(2);
        expect(clampInt(Infinity, 2, 10)).toBe(2); // floor(Infinity) is non-finite -> min
        expect(clampInt(undefined, 2, 10)).toBe(2);
    });
});

describe('pickBySeed', () => {
    const arr = ['a', 'b', 'c'];
    it('is deterministic for a given seed', () => {
        expect(pickBySeed(arr, 0)).toBe('a');
        expect(pickBySeed(arr, 4)).toBe('b'); // 4 % 3 === 1
        expect(pickBySeed(arr, 4)).toBe('b');
    });
    it('handles negative and fractional seeds', () => {
        expect(pickBySeed(arr, -1)).toBe('b'); // abs(-1) % 3
        expect(pickBySeed(arr, 2.9)).toBe('c'); // floor(2.9) % 3
    });
});

describe('randomItem', () => {
    it('uses the injected rng to index', () => {
        const arr = ['x', 'y', 'z'];
        expect(randomItem(arr, () => 0)).toBe('x');
        expect(randomItem(arr, () => 0.5)).toBe('y');
        expect(randomItem(arr, () => 0.99)).toBe('z');
    });
});

describe('randomInt', () => {
    it('returns an inclusive integer in [min, max]', () => {
        expect(randomInt(1, 6, () => 0)).toBe(1);
        expect(randomInt(1, 6, () => 0.999)).toBe(6);
        expect(randomInt(3, 3, () => 0.5)).toBe(3);
    });
});
