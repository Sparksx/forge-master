// Clan progression — shared by client (perks/UI) and server (level computation).
//
// Clan LEVEL comes from clan XP only (earned by playing together via expeditions
// and missions) — NOT from gold. The treasury is a non-power "clan bank" that funds
// expedition launch costs, so accumulating gold can never buy clan power.

// XP required to go FROM level n TO level n+1 grows linearly:
//   step(n) = CLAN_XP_BASE * n
// So cumulative XP for level L is CLAN_XP_BASE * (L-1)*L/2.
export const CLAN_XP_BASE = 1000;
export const CLAN_MAX_LEVEL = 30;

/** Cumulative clan XP required to reach a given clan level (level >= 1). */
export function xpForLevel(level) {
    const n = Math.max(1, level) - 1;
    return Math.floor(CLAN_XP_BASE * (n * (n + 1)) / 2);
}

/** Derive clan level from total clan XP. */
export function clanLevelFromXp(xp) {
    let level = 1;
    while (level < CLAN_MAX_LEVEL && xp >= xpForLevel(level + 1)) {
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
        forgeSpeedPct: tier * 2, // +2% auto-forge speed per level
        forgeBestOf: 1 + Math.floor(level / 10), // forge rolls N items, keep the best (+1 / 10 levels)
        statBonusPct: tier * 1, // +1% player HP & damage per level (PvE + PvP)
    };
}

/** Progress toward the next level: { level, into, span, pct, atMax }. */
export function clanLevelProgress(xp) {
    const level = clanLevelFromXp(xp);
    if (level >= CLAN_MAX_LEVEL) {
        return { level, into: 0, span: 0, pct: 1, atMax: true };
    }
    const floor = xpForLevel(level);
    const ceil = xpForLevel(level + 1);
    const into = xp - floor;
    const span = ceil - floor;
    return { level, into, span, pct: span > 0 ? into / span : 0, atMax: false };
}
