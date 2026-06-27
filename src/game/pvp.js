// Async PvP client. Fights are resolved server-side against a stored snapshot of
// another player and returned as a deterministic, replayable timeline (seed +
// stat blocks + event log) that the dungeon animates locally.
import { apiFetch } from '../api.js';

/**
 * Resolve one async fight. With no argument the server matchmakes a random
 * opponent (ranked); pass any player's `opponentId` for an unranked friendly
 * duel. Returns { seed, win, winner, friendly, ratingChange, newRating, events,
 * you, opponent } or throws with a readable message.
 */
export async function pvpFight(opponentId) {
    const res = await apiFetch('/api/pvp/fight', {
        method: 'POST',
        ...(opponentId != null ? { body: { opponentId } } : {}),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not start a fight');
    }
    return res.json();
}

/**
 * Fetch a player's public profile (stats + equipped gear) by user id. Powers the
 * shared profile modal opened from the PvP leaderboard. Throws with a readable
 * message on failure.
 */
export async function fetchPlayerProfile(userId) {
    const res = await apiFetch(`/api/players/${userId}/profile`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not load profile');
    }
    return res.json();
}

/** Top players by Elo. Returns [] on failure. */
export async function pvpLeaderboard() {
    try {
        const res = await apiFetch('/api/pvp/leaderboard');
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}
