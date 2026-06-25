import { describe, it, expect } from 'vitest';
import { GOLD_PACKS } from '../config.js';

describe('GOLD_PACKS config', () => {
    it('defines at least one pack', () => {
        expect(GOLD_PACKS.length).toBeGreaterThan(0);
    });

    it('has unique pack ids that fit the Purchase.packId column (VarChar(30))', () => {
        const ids = GOLD_PACKS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
            expect(id.length).toBeLessThanOrEqual(30);
        }
    });

    it('has positive integer gold, non-negative bonus, and positive price for every pack', () => {
        for (const p of GOLD_PACKS) {
            expect(Number.isInteger(p.gold)).toBe(true);
            expect(p.gold).toBeGreaterThan(0);
            expect(Number.isInteger(p.bonus)).toBe(true);
            expect(p.bonus).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(p.priceCents)).toBe(true);
            expect(p.priceCents).toBeGreaterThan(0);
            expect(typeof p.label).toBe('string');
            expect(p.label.length).toBeGreaterThan(0);
        }
    });

    it('grants gold only — no gear, diamonds, or other power is bundled in a pack', () => {
        // Guards the non-pay-to-win contract: packs sell the scarce currency, nothing else.
        const allowed = new Set(['id', 'gold', 'bonus', 'priceCents', 'label', 'oneTime', 'tag']);
        for (const p of GOLD_PACKS) {
            for (const key of Object.keys(p)) {
                expect(allowed.has(key)).toBe(true);
            }
        }
    });

    it('improves gold-per-dollar as packs get more expensive (volume discount, monotonic)', () => {
        // Sort by price; total gold per cent should never decrease as price rises.
        const byPrice = [...GOLD_PACKS]
            .filter((p) => !p.oneTime) // one-time intro packs are intentionally great value
            .sort((a, b) => a.priceCents - b.priceCents);
        for (let i = 1; i < byPrice.length; i++) {
            const prev = (byPrice[i - 1].gold + byPrice[i - 1].bonus) / byPrice[i - 1].priceCents;
            const cur = (byPrice[i].gold + byPrice[i].bonus) / byPrice[i].priceCents;
            expect(cur).toBeGreaterThanOrEqual(prev);
        }
    });
});
