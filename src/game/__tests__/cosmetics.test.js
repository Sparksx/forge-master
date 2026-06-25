import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../api.js', () => ({
    apiFetch: vi.fn(() => Promise.resolve({ ok: true })),
    getAccessToken: vi.fn(() => null),
}));

import {
    getGold, getAvatar, setAvatar, getFrame, setFrame,
    ownsCosmetic, purchaseCosmetic, getOwnedCosmetics, addGold, resetProgress,
} from '../state.js';
import { PREMIUM_AVATARS, FRAMES } from '../../../shared/cosmetics.js';

const AVATAR = PREMIUM_AVATARS[0];
const FRAME = FRAMES.find((f) => !f.free && f.price > 0);

beforeEach(() => {
    resetProgress();
});

describe('cosmetic ownership defaults', () => {
    it('owns the free base avatar and the none frame, but no premium cosmetics', () => {
        expect(ownsCosmetic('wizard')).toBe(true);
        expect(ownsCosmetic('none')).toBe(true);
        expect(ownsCosmetic(AVATAR.id)).toBe(false);
        expect(getOwnedCosmetics()).toEqual([]);
        expect(getFrame()).toBe('none');
    });
});

describe('purchaseCosmetic', () => {
    it('rejects a purchase the player cannot afford and keeps gold/ownership intact', () => {
        const res = purchaseCosmetic(AVATAR.id);
        expect(res.ok).toBe(false);
        expect(ownsCosmetic(AVATAR.id)).toBe(false);
        expect(getGold()).toBe(100);
    });

    it('deducts gold and grants ownership on a successful buy', () => {
        addGold(AVATAR.price);
        const before = getGold();
        const res = purchaseCosmetic(AVATAR.id);
        expect(res.ok).toBe(true);
        expect(getGold()).toBe(before - AVATAR.price);
        expect(ownsCosmetic(AVATAR.id)).toBe(true);
        expect(getOwnedCosmetics()).toContain(AVATAR.id);
    });

    it('refuses to buy the same cosmetic twice (no double charge)', () => {
        addGold(AVATAR.price * 2);
        expect(purchaseCosmetic(AVATAR.id).ok).toBe(true);
        const afterFirst = getGold();
        const second = purchaseCosmetic(AVATAR.id);
        expect(second.ok).toBe(false);
        expect(getGold()).toBe(afterFirst);
    });

    it('rejects an unknown cosmetic id', () => {
        addGold(99999);
        expect(purchaseCosmetic('not-a-real-id').ok).toBe(false);
    });
});

describe('equipping cosmetics', () => {
    it('only lets you wear a premium avatar you own', () => {
        setAvatar(AVATAR.id);
        expect(getAvatar()).toBe('wizard'); // not owned → ignored
        addGold(AVATAR.price);
        purchaseCosmetic(AVATAR.id);
        setAvatar(AVATAR.id);
        expect(getAvatar()).toBe(AVATAR.id);
    });

    it('only equips frames you own and rejects non-frame ids', () => {
        expect(setFrame(FRAME.id)).toBe(false);
        expect(getFrame()).toBe('none');
        addGold(FRAME.price);
        purchaseCosmetic(FRAME.id);
        expect(setFrame(FRAME.id)).toBe(true);
        expect(getFrame()).toBe(FRAME.id);
        // The free none frame is always equippable (to remove a frame).
        expect(setFrame('none')).toBe(true);
        // A premium avatar id is not a frame.
        expect(setFrame(AVATAR.id)).toBe(false);
    });
});
