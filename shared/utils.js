// Tiny pure helpers shared by client AND server. Kept dependency-free so they can
// be imported from src/game (browser), src/screens, and server/ alike. These
// consolidate micro-helpers that were previously copy-pasted across the codebase
// (integer clamping, weighted/seeded array indexing, random ints).

/** Clamp a value to an integer within [min, max], treating junk (NaN/∞) as min. */
export function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

/**
 * Deterministically index into `arr` from an arbitrary numeric seed. The same
 * seed always yields the same element — used for stable names/icons and for
 * pairing two arrays off one seed (e.g. matching an enemy name to its emoji).
 */
export function pickBySeed(arr, seed) {
    return arr[Math.abs(Math.floor(seed)) % arr.length];
}

/** Pick a random element from `arr`. `rng` is injectable for deterministic tests. */
export function randomItem(arr, rng = Math.random) {
    return arr[Math.floor(rng() * arr.length)];
}

/** Random integer in [min, max] inclusive. `rng` is injectable for tests. */
export function randomInt(min, max, rng = Math.random) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
