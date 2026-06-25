// Pure (DB-free) helpers for async PvP matchmaking + rating, kept out of the
// route module so they can be unit-tested without pulling in Prisma.
import { PVP_BASE_POWER_RANGE, PVP_POWER_RANGE_EXPANSION } from '../../shared/pvp-config.js';

export const K_FACTOR = 32;
// Snapshot matching widens the live-PvP base range a few notches so a fight can
// almost always be found from the candidate pool.
export const MAX_POWER_RANGE = PVP_BASE_POWER_RANGE + 6 * PVP_POWER_RANGE_EXPANSION;

/**
 * Choose an opponent snapshot by power proximity. Prefers a random pick from all
 * candidates within MAX_POWER_RANGE; if none qualify, falls back to the closest
 * available power. Returns null only when there are no candidates at all.
 * `rng` is injectable for deterministic tests.
 */
export function pickOpponent(candidates, attackerPower, rng = Math.random) {
    if (!candidates.length) return null;
    const withDiff = candidates.map((c) => {
        const avg = (c.power + attackerPower) / 2 || 1;
        return { c, diff: Math.abs(c.power - attackerPower) / avg };
    });
    const inRange = withDiff.filter((x) => x.diff <= MAX_POWER_RANGE);
    if (inRange.length) return inRange[Math.floor(rng() * inRange.length)].c;
    withDiff.sort((a, b) => a.diff - b.diff);
    return withDiff[0].c;
}

/**
 * Attacker-only, power-weighted Elo delta. Beating a stronger snapshot pays more;
 * farming a weaker one pays less (dampened with sqrt to avoid wild swings). The
 * offline defender's rating is never touched.
 */
export function attackerEloChange(attackerRating, opponentRating, win, attackerPower, opponentPower) {
    const expected = 1 / (1 + Math.pow(10, (opponentRating - attackerRating) / 400));
    const ratio = Math.max(0.25, Math.min(4,
        win ? opponentPower / attackerPower : attackerPower / opponentPower));
    const k = win ? K_FACTOR * Math.sqrt(ratio) : K_FACTOR / Math.sqrt(ratio);
    const change = Math.round(k * ((win ? 1 : 0) - expected));
    return win ? Math.max(1, change) : Math.min(-1, change);
}
