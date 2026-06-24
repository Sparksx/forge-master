// Clan rank ladder + permissions — shared by client (UI gating) and server (enforcement).
//
// Ranks are an ordered ladder. `owner` is the Leader (anchored by Clan.ownerId);
// everything below is assignable via promote/demote. The DB stores the rank `key`
// in ClanMember.role, so existing rows (owner/officer/member) migrate unchanged.

export const RANKS = [
    { key: 'owner', name: 'Leader', order: 3, icon: '👑' },
    { key: 'coleader', name: 'Co-Leader', order: 2, icon: '🛡️' },
    { key: 'officer', name: 'Officer', order: 1, icon: '⭐' },
    { key: 'member', name: 'Member', order: 0, icon: '🔰' },
];

const BY_KEY = Object.fromEntries(RANKS.map((r) => [r.key, r]));

/** The rank order (higher = more authority). Unknown keys fall back to member. */
export function rankOrder(key) {
    return (BY_KEY[key] || BY_KEY.member).order;
}

/** Rank metadata (name/icon/order) for a key, defaulting to member. */
export function rankInfo(key) {
    return BY_KEY[key] || BY_KEY.member;
}

// Highest rank a member can be promoted to / demoted from via the ladder. `owner`
// is never set by promote/demote — it only changes through ownership transfer.
export const ASSIGNABLE_RANKS = ['coleader', 'officer', 'member'];

/** Minimum rank order allowed to perform a non-target action. */
const ACTION_MIN_ORDER = {
    startActivity: rankOrder('officer'), // launch expeditions / missions
    cancelActivity: rankOrder('coleader'), // cancel any running expedition (the launcher can always cancel their own)
    editClan: rankOrder('coleader'), // edit emblem/description
    disband: rankOrder('owner'),
    transfer: rankOrder('owner'),
};

/**
 * Can a member of `actorKey` perform `action` (optionally on a `targetKey` member)?
 *
 * Member-targeting actions (promote/demote/kick) require the actor to outrank the
 * target strictly AND to be at least an officer. Promotions are also capped so no
 * one can mint a rank at or above their own.
 */
export function can(actorKey, action, targetKey = null) {
    const actor = rankOrder(actorKey);

    if (action === 'promote' || action === 'demote' || action === 'kick') {
        if (targetKey === null || targetKey === undefined) return false;
        const target = rankOrder(targetKey);
        if (actor < rankOrder('officer')) return false; // members can't manage anyone
        if (actor <= target) return false; // can only act on strictly lower ranks
        return true;
    }

    const min = ACTION_MIN_ORDER[action];
    if (min === undefined) return false; // unknown action
    return actor >= min;
}

/** Next rank up from `key` within the assignable ladder, or null if already at the top. */
export function nextRankUp(key) {
    if (key === 'owner') return null;
    if (key === 'member') return 'officer';
    if (key === 'officer') return 'coleader';
    return null; // coleader's only step up is ownership transfer
}

/** Next rank down from `key` within the assignable ladder, or null if already lowest. */
export function nextRankDown(key) {
    if (key === 'coleader') return 'officer';
    if (key === 'officer') return 'member';
    return null; // members and owner have no demote step
}
