/**
 * Admin client module — role helpers + API/socket wrappers for the in-game
 * staff panel. Scoped to the current game's features (gold economy, forge
 * level, arena, PvP) plus moderation, roles, stats, audit logs and broadcasts.
 */

import { apiFetch } from '../api.js';
import { getSocket } from '../socket-client.js';
import { getCurrentUser } from '../auth.js';

// ─── Role helpers ─────────────────────────────────────────────────
export function getUserRole() {
    return getCurrentUser()?.role || 'user';
}
export function isStaff() {
    const r = getUserRole();
    return r === 'admin' || r === 'moderator';
}
export function isAdmin() {
    return getUserRole() === 'admin';
}

// ─── Internal fetch helper ────────────────────────────────────────
async function call(path, { method = 'GET', body } = {}) {
    const res = await apiFetch(path, { method, body });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
}

// ─── Moderation + lookups (admin + moderator) ─────────────────────
export const searchUsers = (q) =>
    call(`/api/admin/users/search?q=${encodeURIComponent(q)}`);

export const getUserProfile = (userId) =>
    call(`/api/admin/users/${userId}/profile`);

export const warnUser = (userId, reason) =>
    call(`/api/admin/users/${userId}/warn`, { method: 'POST', body: { reason } });

export const muteUser = (userId, reason, duration) =>
    call(`/api/admin/users/${userId}/mute`, { method: 'POST', body: { reason, duration } });

export const unmuteUser = (userId) =>
    call(`/api/admin/users/${userId}/unmute`, { method: 'POST', body: {} });

export const banUser = (userId, reason, duration) =>
    call(`/api/admin/users/${userId}/ban`, { method: 'POST', body: { reason, duration: duration || undefined } });

export const unbanUser = (userId) =>
    call(`/api/admin/users/${userId}/unban`, { method: 'POST', body: {} });

/** Disconnect a user's live sockets (handled server-side via the socket layer). */
export function kickUser(userId) {
    const s = getSocket();
    if (s) s.emit('admin:kick-user', { userId });
    // Best-effort audit log; ignore failures so the kick still feels instant.
    apiFetch(`/api/admin/users/${userId}/kick`, { method: 'POST' }).catch(() => {});
}

// ─── Resource / progression edits (admin only) ────────────────────
export const addGoldToUser = (userId, amount) =>
    call(`/api/admin/users/${userId}/gold`, { method: 'POST', body: { amount } });

export const setUserForgeLevel = (userId, forgeLevel) =>
    call(`/api/admin/users/${userId}/forge-level`, { method: 'POST', body: { forgeLevel } });

export const setUserRole = (userId, role) =>
    call(`/api/admin/users/${userId}/role`, { method: 'PUT', body: { role } });

export const resetUserState = (userId) =>
    call(`/api/admin/users/${userId}/reset-state`, { method: 'DELETE' });

// ─── Server insight (admin only / staff) ──────────────────────────
export const getServerStats = () => call('/api/admin/stats');
export const getAuditLog = (page = 1) => call(`/api/admin/audit-log?page=${page}`);

/** Broadcast a system message to all connected players (admin only). */
export function broadcastMessage(message) {
    const s = getSocket();
    if (s) s.emit('admin:broadcast', { message });
    // Mirror to the audit log endpoint (also enforces the admin role server-side).
    return call('/api/admin/broadcast', { method: 'POST', body: { message } });
}
