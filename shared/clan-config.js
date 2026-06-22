// Clan progression — shared by client (perks/UI) and server (level computation).
// Treasury is the sum of all gold members have contributed.

// Gold required to go FROM level n TO level n+1 grows linearly:
//   step(n) = CLAN_LEVEL_BASE * n
// So cumulative treasury for level L is CLAN_LEVEL_BASE * (L-1)*L/2.
export const CLAN_LEVEL_BASE = 5000;
export const CLAN_MAX_LEVEL = 30;

/** Cumulative treasury required to reach a given clan level (level >= 1). */
export function treasuryForLevel(level) {
    const n = Math.max(1, level) - 1;
    return Math.floor(CLAN_LEVEL_BASE * (n * (n + 1)) / 2);
}

/** Derive clan level from total treasury. */
export function clanLevelFromTreasury(treasury) {
    let level = 1;
    while (level < CLAN_MAX_LEVEL && treasury >= treasuryForLevel(level + 1)) {
        level++;
    }
    return level;
}

/** Passive perks granted to every member, scaling with clan level. */
export function clanPerks(level) {
    const tier = Math.max(0, level - 1);
    return {
        goldBonusPct: tier * 3, // +3% gold from all sources per level
        forgeLuckPct: tier * 2, // +2% shift toward higher rarities per level
        maxMembers: 10 + tier * 2,
    };
}

/** Progress toward the next level: { current, next, into, span, pct }. */
export function clanLevelProgress(treasury) {
    const level = clanLevelFromTreasury(treasury);
    if (level >= CLAN_MAX_LEVEL) {
        return { level, into: 0, span: 0, pct: 1, atMax: true };
    }
    const floor = treasuryForLevel(level);
    const ceil = treasuryForLevel(level + 1);
    const into = treasury - floor;
    const span = ceil - floor;
    return { level, into, span, pct: span > 0 ? into / span : 0, atMax: false };
}
