/**
 * Admin module — client-side admin/moderator logic.
 * Handles admin mode toggle, resource management, and moderation actions.
 */

import { apiFetch } from './api.js';
import { getSocket } from './socket-client.js';
import { getCurrentUser } from './auth.js';

/**
 * Check if current user has admin or moderator role
 */
export function isStaff() {
    const user = getCurrentUser();
    return user && (user.role === 'admin' || user.role === 'moderator');
}

export function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

export function isModerator() {
    const user = getCurrentUser();
    return user && user.role === 'moderator';
}

/**
 * Get user role
 */
export function getUserRole() {
    const user = getCurrentUser();
    return user?.role || 'user';
}

// ─── Admin API calls ──────────────────────────────────────────────

export async function searchUsers(query) {
    const res = await apiFetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
}

export async function getUserProfile(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/profile`);
    if (!res.ok) throw new Error('Profile fetch failed');
    return res.json();
}

export async function warnUser(userId, reason) {
    const res = await apiFetch(`/api/admin/users/${userId}/warn`, {
        method: 'POST', body: { reason },
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Warn failed');
    }
    return res.json();
}

export async function muteUser(userId, reason, duration) {
    const res = await apiFetch(`/api/admin/users/${userId}/mute`, {
        method: 'POST', body: { reason, duration },
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Mute failed');
    }
    return res.json();
}

export async function unmuteUser(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/unmute`, {
        method: 'POST', body: {},
    });
    if (!res.ok) throw new Error('Unmute failed');
    return res.json();
}

export async function banUser(userId, reason, duration) {
    const res = await apiFetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST', body: { reason, duration: duration || undefined },
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ban failed');
    }
    return res.json();
}

export async function unbanUser(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST', body: {},
    });
    if (!res.ok) throw new Error('Unban failed');
    return res.json();
}

export async function kickUser(userId) {
    const socket = getSocket();
    if (socket) {
        socket.emit('admin:kick-user', { userId });
    }
}

export async function addGoldToUser(userId, amount) {
    const res = await apiFetch(`/api/admin/users/${userId}/gold`, {
        method: 'POST', body: { amount },
    });
    if (!res.ok) throw new Error('Add gold failed');
    return res.json();
}

export async function addEssenceToUser(userId, amount) {
    const res = await apiFetch(`/api/admin/users/${userId}/essence`, {
        method: 'POST', body: { amount },
    });
    if (!res.ok) throw new Error('Add essence failed');
    return res.json();
}

export async function addDiamondsToUser(userId, amount) {
    const res = await apiFetch(`/api/admin/users/${userId}/diamonds`, {
        method: 'POST', body: { amount },
    });
    if (!res.ok) throw new Error('Add diamonds failed');
    return res.json();
}

export async function setUserLevel(userId, level) {
    const res = await apiFetch(`/api/admin/users/${userId}/level`, {
        method: 'POST', body: { level },
    });
    if (!res.ok) throw new Error('Set level failed');
    return res.json();
}

export async function setUserRole(userId, role) {
    const res = await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT', body: { role },
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Set role failed');
    }
    return res.json();
}

export async function resetUserState(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/reset-state`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Reset failed');
    return res.json();
}

export async function getServerStats() {
    const res = await apiFetch('/api/admin/stats');
    if (!res.ok) throw new Error('Stats fetch failed');
    return res.json();
}

export async function getAuditLog(page = 1, action = null) {
    let url = `/api/admin/audit-log?page=${page}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Audit log fetch failed');
    return res.json();
}

export function broadcastMessage(message) {
    const socket = getSocket();
    if (socket) {
        socket.emit('admin:broadcast', { message });
    }
}

export function deleteChatMessage(messageId) {
    const socket = getSocket();
    if (socket) {
        socket.emit('chat:delete-message', { messageId });
    }
}
