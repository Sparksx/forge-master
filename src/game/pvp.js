// Async PvP client. Fights are resolved server-side against a stored snapshot of
// another player and returned as a deterministic, replayable timeline (seed +
// stat blocks + event log) that the dungeon animates locally.
import { apiFetch } from '../api.js';

/** Resolve one async fight. Returns { seed, win, winner, ratingChange, newRating,
 *  events, you, opponent } or throws with a readable message. */
export async function pvpFight() {
    const res = await apiFetch('/api/pvp/fight', { method: 'POST' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not start a fight');
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
