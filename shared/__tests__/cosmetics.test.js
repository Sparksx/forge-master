import { describe, it, expect } from 'vitest';
import {
    PREMIUM_AVATARS, FRAMES, COSMETICS, getCosmetic, isFreeCosmetic, cosmeticPrice,
} from '../cosmetics.js';

describe('cosmetics catalog', () => {
    it('defines premium avatars and frames', () => {
        expect(PREMIUM_AVATARS.length).toBeGreaterThan(0);
        expect(FRAMES.length).toBeGreaterThan(0);
    });

    it('has globally unique cosmetic ids that fit a VarChar(30) save', () => {
        const ids = COSMETICS.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
            expect(id.length).toBeLessThanOrEqual(30);
        }
    });

    it('prices every premium avatar with positive integer gold and an emoji', () => {
        for (const a of PREMIUM_AVATARS) {
            expect(Number.isInteger(a.price)).toBe(true);
            expect(a.price).toBeGreaterThan(0);
            expect(typeof a.emoji).toBe('string');
            expect(a.emoji.length).toBeGreaterThan(0);
            expect(typeof a.name).toBe('string');
        }
    });

    it('includes exactly one free default frame and prices the rest in gold', () => {
        const free = FRAMES.filter((f) => f.free || f.price === 0);
        expect(free.length).toBe(1);
        expect(free[0].id).toBe('none');
        for (const f of FRAMES.filter((f) => !f.free && f.price > 0)) {
            expect(Number.isInteger(f.price)).toBe(true);
            expect(f.price).toBeGreaterThan(0);
        }
    });

    it('tags every catalog entry with a kind of avatar or frame', () => {
        for (const c of COSMETICS) {
            expect(['avatar', 'frame']).toContain(c.kind);
        }
    });

    it('looks cosmetics up by id and reports price + freeness', () => {
        const a = PREMIUM_AVATARS[0];
        expect(getCosmetic(a.id)).toMatchObject({ id: a.id, kind: 'avatar' });
        expect(cosmeticPrice(a.id)).toBe(a.price);
        expect(isFreeCosmetic(a.id)).toBe(false);
        expect(isFreeCosmetic('none')).toBe(true);
        expect(getCosmetic('does-not-exist')).toBeNull();
        expect(cosmeticPrice('does-not-exist')).toBe(0);
    });

    it('keeps retired (hidden) cosmetics in the catalog so owners can still wear them', () => {
        // `hidden` only removes an entry from the shop; it stays a valid, lookup-able
        // cosmetic so anyone already owning/wearing it keeps it.
        for (const c of COSMETICS.filter((c) => c.hidden)) {
            expect(getCosmetic(c.id)).toMatchObject({ id: c.id });
            expect(cosmeticPrice(c.id)).toBe(c.price);
        }
    });

    it('grants no power — cosmetics carry no stat/bonus fields', () => {
        const allowed = new Set(['id', 'emoji', 'name', 'price', 'free', 'kind', 'hidden']);
        for (const c of COSMETICS) {
            for (const key of Object.keys(c)) {
                expect(allowed.has(key)).toBe(true);
            }
        }
    });
});
