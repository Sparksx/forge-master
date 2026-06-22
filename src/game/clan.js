// Clan REST client. Keeps a cache of the player's clan and pushes perks into state.
import { apiFetch, getAccessToken } from '../api.js';
import { setClanPerks } from './state.js';
import { gameEvents, EVENTS } from '../events.js';

let myClan = null;
let loaded = false;

export const getMyClanCached = () => myClan;
export const hasLoadedClan = () => loaded;
export const canUseClans = () => !!getAccessToken();

function setMyClan(clan) {
    myClan = clan || null;
    loaded = true;
    setClanPerks(clan?.perks || { goldBonusPct: 0, forgeLuckPct: 0 });
    gameEvents.emit(EVENTS.CLAN_CHANGED, myClan);
}

async function readJson(res) {
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
}

/** Load the player's current clan (or null). Call once on boot. */
export async function loadMyClan() {
    if (!canUseClans()) { setMyClan(null); return null; }
    try {
        const data = await readJson(await apiFetch('/api/clans/mine'));
        setMyClan(data.clan);
        return myClan;
    } catch (err) {
        console.error('loadMyClan failed:', err);
        loaded = true;
        return null;
    }
}

export async function listClans(query = '') {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return readJson(await apiFetch(`/api/clans${q}`));
}

export async function createClan(fields) {
    const clan = await readJson(await apiFetch('/api/clans', { method: 'POST', body: fields }));
    setMyClan(clan);
    return clan;
}

export async function joinClan(id) {
    const clan = await readJson(await apiFetch(`/api/clans/${id}/join`, { method: 'POST' }));
    setMyClan(clan);
    return clan;
}

export async function leaveClan() {
    await readJson(await apiFetch('/api/clans/leave', { method: 'POST' }));
    setMyClan(null);
}

export async function contribute(amount) {
    const clan = await readJson(await apiFetch('/api/clans/contribute', { method: 'POST', body: { amount } }));
    setMyClan(clan);
    return clan;
}

export async function refreshMyClan() {
    if (!myClan) return null;
    return loadMyClan();
}
