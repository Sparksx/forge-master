// Clan mission tracker. Watches gameplay events and feeds progress toward the
// player's clan missions. Progress is accumulated locally and flushed to the
// server in small batches — only when the player is in a clan that actually has a
// matching active mission, so we never spam the API.
import { gameEvents, EVENTS } from '../events.js';
import { EQUIPMENT_TYPES, rankKind } from './config.js';
import { MISSION_PROGRESS_MAX_PER_REPORT } from '../../shared/clan-activities.js';
import {
    getMyClanCached, listMissions, reportMissionProgress, refreshMyClan,
} from './clan.js';

// Pending progress per mission type, awaiting flush.
const pending = { forge_count: 0, defeat_enemies: 0, win_bosses: 0, swap_all_gear: 0, reach_arena: 0 };

// Mission types currently active for the player's clan (refreshed periodically).
let activeTypes = new Set();
let lastTypeFetch = 0;
const TYPE_TTL = 60 * 1000; // re-check active missions at most once a minute

// Slots equipped since the last full-set swap (for the swap_all_gear mission).
const swappedSlots = new Set();

let flushTimer = null;
const FLUSH_DEBOUNCE = 8000;

function inClan() {
    return !!getMyClanCached();
}

async function refreshActiveTypes(force = false) {
    if (!inClan()) { activeTypes = new Set(); return; }
    const now = Date.now();
    if (!force && now - lastTypeFetch < TYPE_TTL) return;
    lastTypeFetch = now;
    try {
        const data = await listMissions();
        activeTypes = new Set((data?.missions || []).filter((m) => m.status === 'active').map((m) => m.type));
    } catch {
        /* leave previous set in place */
    }
}

function bump(type, amount = 1) {
    if (!inClan() || amount <= 0) return;
    pending[type] = (pending[type] || 0) + amount;
    scheduleFlush();
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, FLUSH_DEBOUNCE);
}

async function flush() {
    flushTimer = null;
    if (!inClan()) { resetPending(); return; }
    await refreshActiveTypes();

    let completedAny = false;
    for (const type of Object.keys(pending)) {
        let amount = pending[type];
        if (amount <= 0) continue;
        // Nothing tracks this type right now — drop it so we don't reschedule forever.
        if (!activeTypes.has(type)) { pending[type] = 0; continue; }
        // Send in clamped chunks so a long offline burst still lands.
        while (amount > 0) {
            const chunk = Math.min(amount, MISSION_PROGRESS_MAX_PER_REPORT);
            const res = await reportMissionProgress(type, chunk);
            if (res?.completed?.length) completedAny = true;
            amount -= chunk;
            if (!res) break; // network error — keep the remainder for next time
        }
        pending[type] = amount;
    }

    // A completed mission grants clan XP server-side — refresh perks/level.
    if (completedAny) { lastTypeFetch = 0; await refreshMyClan(); }
    if (Object.values(pending).some((n) => n > 0)) scheduleFlush();
}

function resetPending() {
    for (const k of Object.keys(pending)) pending[k] = 0;
}

let started = false;
/** Wire the tracker to the event bus. Safe to call once on boot. */
export function initClanMissions() {
    if (started) return;
    started = true;

    gameEvents.on(EVENTS.ITEM_FORGED, () => bump('forge_count', 1));

    gameEvents.on(EVENTS.COMBAT_MONSTER_DEFEATED, () => bump('defeat_enemies', 1));

    gameEvents.on(EVENTS.ARENA_RESULT, ({ win, rank } = {}) => {
        if (!win) return;
        bump('reach_arena', 1); // each cleared stage
        if (rankKind(rank) !== 'normal') bump('win_bosses', 1);
    });

    // A full-set swap = the player has equipped a fresh item in every slot.
    gameEvents.on(EVENTS.ITEM_EQUIPPED, (item) => {
        if (!item?.type) return;
        swappedSlots.add(item.type);
        if (EQUIPMENT_TYPES.every((t) => swappedSlots.has(t))) {
            swappedSlots.clear();
            bump('swap_all_gear', 1);
        }
    });

    // Refresh the active-mission set whenever the clan changes.
    gameEvents.on(EVENTS.CLAN_CHANGED, () => { lastTypeFetch = 0; });
}
