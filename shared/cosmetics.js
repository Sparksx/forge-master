// Cosmetics catalog — purely visual, bought with in-game GOLD (never real money,
// never gear). This is the sanctioned gold *sink* that closes the monetization
// loop: real money → gold (the Stripe gold shop) → cosmetics. Because cosmetics
// grant zero power, paying for gold and spending it here stays firmly out of
// pay-to-win territory (see CLAUDE.md / REDESIGN.md).
//
// Lives in shared/ as the single source of truth: the client renders & prices
// the shop from it, and the server validates owned-cosmetic saves against it.

// Premium avatars (emoji) beyond the free roster in src/game/config.js. The free
// avatars are always owned; these must be bought with gold before they can be worn.
export const PREMIUM_AVATARS = [
    { id: 'ninja',    emoji: '🥷', name: 'Shadow Ninja',  price: 2000 },
    { id: 'fox',      emoji: '🦊', name: 'Trickster Fox', price: 2000 },
    { id: 'unicorn',  emoji: '🦄', name: 'Unicorn',       price: 4000 },
    { id: 'genie',    emoji: '🧞', name: 'Genie',         price: 6000 },
    { id: 'demon',    emoji: '👹', name: 'Demon',         price: 9000 },
    { id: 'alien',    emoji: '👽', name: 'Starborn',      price: 15000 },
];

// Profile frames decorate the avatar with a CSS border/glow. `none` is the free
// default (always owned); the rest are gold purchases. `frameClass` maps to the
// `.frame-*` rules in css/reforged.css.
export const FRAMES = [
    { id: 'none',   name: 'No Frame',     price: 0,     free: true },
    { id: 'bronze', name: 'Bronze Ring',  price: 1500 },
    { id: 'silver', name: 'Silver Ring',  price: 4000 },
    { id: 'gold',   name: 'Gilded Ring',  price: 9000 },
    { id: 'mythic', name: 'Mythic Halo',  price: 20000 },
];

// All catalog entries, tagged with their kind for unified lookups.
export const COSMETICS = [
    ...PREMIUM_AVATARS.map((a) => ({ ...a, kind: 'avatar' })),
    ...FRAMES.map((f) => ({ ...f, kind: 'frame' })),
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

/** Look up a cosmetic (avatar or frame) by id, or null if unknown. */
export function getCosmetic(id) {
    return BY_ID.get(id) || null;
}

/** A cosmetic that is free / owned by default (the `none` frame). */
export function isFreeCosmetic(id) {
    const c = BY_ID.get(id);
    return !!c && (c.free === true || c.price === 0);
}

/** Gold price of a cosmetic (0 if free or unknown). */
export function cosmeticPrice(id) {
    return BY_ID.get(id)?.price ?? 0;
}
