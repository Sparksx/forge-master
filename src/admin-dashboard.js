/**
 * Admin Dashboard — standalone page entry point.
 * Handles authentication, role-gating, and renders the full admin dashboard.
 */

import '../css/base.css';
import '../css/admin-dashboard.css';

import { apiFetch, getAccessToken, getStoredRefreshToken, refreshAccessToken } from './api.js';
import { io } from 'socket.io-client';

// ─── State ───────────────────────────────────────────────────────
let currentUser = null;
let currentSection = 'players';
let selectedUserId = null;
let logsPage = 1;
let socket = null;

// ─── Auth: restore session ───────────────────────────────────────
async function restoreSession() {
    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) return null;

    try {
        // Use the shared refreshAccessToken() which has a mutex to prevent
        // concurrent rotation with the game tab (same localStorage tokens).
        const refreshed = await refreshAccessToken();
        if (!refreshed) return null;

        const meRes = await apiFetch('/api/auth/me');
        if (!meRes.ok) return null;

        const meData = await meRes.json();
        return meData.user;
    } catch {
        return null;
    }
}

// ─── Socket connection (for kick & broadcast) ────────────────────
function connectSocket() {
    const token = getAccessToken();
    if (!token) return;

    socket = io({
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
    });
}

function getSocket() {
    return socket;
}

// ─── Admin API wrappers ──────────────────────────────────────────
async function searchUsers(query) {
    const res = await apiFetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Recherche echouee');
    return res.json();
}

async function getUserProfile(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/profile`);
    if (!res.ok) throw new Error('Chargement du profil echoue');
    return res.json();
}

async function warnUser(userId, reason) {
    const res = await apiFetch(`/api/admin/users/${userId}/warn`, { method: 'POST', body: { reason } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Echec'); }
    return res.json();
}

async function muteUser(userId, reason, duration) {
    const res = await apiFetch(`/api/admin/users/${userId}/mute`, { method: 'POST', body: { reason, duration } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Echec'); }
    return res.json();
}

async function unmuteUser(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/unmute`, { method: 'POST', body: {} });
    if (!res.ok) throw new Error('Unmute echoue');
    return res.json();
}

async function banUser(userId, reason, duration) {
    const res = await apiFetch(`/api/admin/users/${userId}/ban`, { method: 'POST', body: { reason, duration: duration || undefined } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Echec'); }
    return res.json();
}

async function unbanUser(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/unban`, { method: 'POST', body: {} });
    if (!res.ok) throw new Error('Unban echoue');
    return res.json();
}

function kickUser(userId) {
    const s = getSocket();
    if (s) s.emit('admin:kick-user', { userId });
}

async function addGoldToUser(userId, amount) {
    const res = await apiFetch(`/api/admin/users/${userId}/gold`, { method: 'POST', body: { amount } });
    if (!res.ok) throw new Error('Echec ajout gold');
    return res.json();
}

async function addEssenceToUser(userId, amount) {
    const res = await apiFetch(`/api/admin/users/${userId}/essence`, { method: 'POST', body: { amount } });
    if (!res.ok) throw new Error('Echec ajout essence');
    return res.json();
}

async function addDiamondsToUser(userId, amount) {
    const res = await apiFetch(`/api/admin/users/${userId}/diamonds`, { method: 'POST', body: { amount } });
    if (!res.ok) throw new Error('Echec ajout diamants');
    return res.json();
}

async function setUserLevel(userId, level) {
    const res = await apiFetch(`/api/admin/users/${userId}/level`, { method: 'POST', body: { level } });
    if (!res.ok) throw new Error('Echec set level');
    return res.json();
}

async function setUserRole(userId, role) {
    const res = await apiFetch(`/api/admin/users/${userId}/role`, { method: 'PUT', body: { role } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Echec'); }
    return res.json();
}

async function resetUserState(userId) {
    const res = await apiFetch(`/api/admin/users/${userId}/reset-state`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Reset echoue');
    return res.json();
}

async function getServerStats() {
    const res = await apiFetch('/api/admin/stats');
    if (!res.ok) throw new Error('Stats echouees');
    return res.json();
}

async function getAuditLog(page = 1, action = null) {
    let url = `/api/admin/audit-log?page=${page}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Logs echoues');
    return res.json();
}

function broadcastMessage(message) {
    const s = getSocket();
    if (s) s.emit('admin:broadcast', { message });
}

// ─── Helpers ─────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('adm-toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `adm-toast adm-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('adm-toast-show'), 10);
    setTimeout(() => {
        toast.classList.remove('adm-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─── Navigation ──────────────────────────────────────────────────
function initNavigation() {
    const navButtons = document.querySelectorAll('[data-section]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(sectionId) {
    currentSection = sectionId;

    // Update nav buttons
    document.querySelectorAll('[data-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    // Update sections
    document.querySelectorAll('.adm-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `section-${sectionId}`);
    });

    // Load data for the section
    switch (sectionId) {
        case 'stats': loadStats(); break;
        case 'logs': logsPage = 1; loadLogs(); break;
        case 'equipment': loadEquipmentSection(); break;
    }
}

// ─── Players Section ─────────────────────────────────────────────
function initPlayersSection() {
    const searchInput = document.getElementById('adm-player-search');
    const searchBtn = document.getElementById('adm-player-search-btn');

    let searchTimeout = null;

    const doSearch = async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        const resultsEl = document.getElementById('adm-player-results');
        resultsEl.innerHTML = '<p class="adm-loading">Recherche...</p>';
        try {
            const data = await searchUsers(q);
            renderPlayerResults(data.users);
        } catch (err) {
            resultsEl.innerHTML = `<p class="adm-error">${escapeHtml(err.message)}</p>`;
        }
    };

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });

    // Real-time search with debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length >= 2) {
            searchTimeout = setTimeout(doSearch, 300);
        } else if (q.length === 0) {
            document.getElementById('adm-player-results').innerHTML = '';
            document.getElementById('adm-player-detail').innerHTML = '';
        }
    });
}

function renderPlayerResults(users) {
    const container = document.getElementById('adm-player-results');
    if (!users.length) {
        container.innerHTML = '<p class="adm-empty">Aucun joueur trouve.</p>';
        return;
    }

    let html = '<div class="adm-player-list">';
    users.forEach(u => {
        const roleBadge = u.role !== 'user'
            ? `<span class="adm-role-tag adm-role-${u.role}">${u.role}</span>`
            : '';
        const guestTag = u.isGuest ? '<span class="adm-guest-tag">invite</span>' : '';
        html += `<div class="adm-player-item" data-uid="${u.id}">` +
            `<span class="adm-player-name">${escapeHtml(u.username)}</span>` +
            `${roleBadge}${guestTag}` +
            `<span class="adm-player-meta">ID: ${u.id} | PvP: ${u.pvpRating}</span>` +
        `</div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.adm-player-item').forEach(el => {
        el.addEventListener('click', () => {
            // highlight selected
            container.querySelectorAll('.adm-player-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            selectedUserId = parseInt(el.dataset.uid);
            loadPlayerDetail(selectedUserId);
        });
    });
}

async function loadPlayerDetail(userId) {
    const detail = document.getElementById('adm-player-detail');
    detail.innerHTML = '<p class="adm-loading">Chargement du profil...</p>';

    try {
        const data = await getUserProfile(userId);
        renderPlayerDetail(detail, data);
    } catch (err) {
        detail.innerHTML = `<p class="adm-error">${escapeHtml(err.message)}</p>`;
    }
}

function renderPlayerDetail(container, data) {
    const { user, warnings, bans, mutes } = data;
    const isAdm = currentUser.role === 'admin';
    const gs = user.gameState || {};
    const player = gs.player || { level: 1 };
    const level = typeof player === 'object' ? player.level : 1;

    let html = '<div class="adm-detail-card">';

    // Header
    html += '<div class="adm-detail-header">';
    html += `<h3>${escapeHtml(user.username)}</h3>`;
    html += `<span class="adm-role-tag adm-role-${user.role}">${user.role}</span>`;
    if (user.isGuest) html += '<span class="adm-guest-tag">invite</span>';
    html += '</div>';

    // Stats grid
    html += '<div class="adm-detail-stats">';
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">${level}</span><span class="adm-stat-lbl">Niveau</span></div>`;
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">${(gs.gold || 0).toLocaleString()}</span><span class="adm-stat-lbl">Gold</span></div>`;
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">${(gs.essence || 0).toLocaleString()}</span><span class="adm-stat-lbl">Essence</span></div>`;
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">${(gs.diamonds || 0).toLocaleString()}</span><span class="adm-stat-lbl">Diamants</span></div>`;
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">Lv.${gs.forgeLevel || 1}</span><span class="adm-stat-lbl">Forge</span></div>`;
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">${user.pvpRating}</span><span class="adm-stat-lbl">ELO</span></div>`;
    html += `<div class="adm-detail-stat"><span class="adm-stat-val">${user.pvpWins}/${user.pvpLosses}</span><span class="adm-stat-lbl">W/L</span></div>`;
    html += '</div>';

    // Moderation actions
    html += '<div class="adm-detail-actions">';
    html += '<h4>Moderation</h4>';
    html += '<div class="adm-btn-row">';
    html += `<button class="adm-btn adm-btn-warn" data-action="warn">Avertir</button>`;
    html += `<button class="adm-btn adm-btn-mute" data-action="mute">Mute</button>`;
    html += `<button class="adm-btn adm-btn-ban" data-action="ban">Ban Temp</button>`;
    html += `<button class="adm-btn adm-btn-kick" data-action="kick">Kick</button>`;
    if (isAdm) {
        html += `<button class="adm-btn adm-btn-permban" data-action="permban">Ban Perm</button>`;
    }
    html += '</div>';

    // Unban/Unmute if applicable
    const hasActiveBan = bans?.some(b => b.active);
    const hasActiveMute = mutes?.some(m => m.active);
    if (hasActiveBan || hasActiveMute) {
        html += '<div class="adm-btn-row">';
        if (hasActiveBan) html += `<button class="adm-btn adm-btn-secondary" data-action="unban">Unban</button>`;
        if (hasActiveMute) html += `<button class="adm-btn adm-btn-secondary" data-action="unmute">Unmute</button>`;
        html += '</div>';
    }
    html += '</div>';

    // Admin-only: resource management
    if (isAdm) {
        html += '<div class="adm-detail-resources">';
        html += '<h4>Ressources (Admin)</h4>';
        html += '<div class="adm-btn-row">';
        html += `<button class="adm-btn adm-btn-gold" data-action="gold-10k">+10K Gold</button>`;
        html += `<button class="adm-btn adm-btn-gold" data-action="gold-100k">+100K Gold</button>`;
        html += `<button class="adm-btn adm-btn-essence-btn" data-action="essence-1k">+1K Essence</button>`;
        html += `<button class="adm-btn adm-btn-essence-btn" data-action="essence-10k">+10K Essence</button>`;
        html += `<button class="adm-btn adm-btn-diamond" data-action="diamond-100">+100 Diamants</button>`;
        html += `<button class="adm-btn adm-btn-diamond" data-action="diamond-1k">+1K Diamants</button>`;
        html += '</div>';
        html += '<div class="adm-btn-row adm-resource-extra">';
        html += `<label>Role: <select id="adm-role-select">`;
        ['user', 'moderator', 'admin'].forEach(r => {
            html += `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`;
        });
        html += `</select></label>`;
        html += `<button class="adm-btn adm-btn-secondary" data-action="set-role">Changer Role</button>`;
        html += `<button class="adm-btn adm-btn-danger" data-action="reset">Reset Etat</button>`;
        html += '</div>';
        html += '</div>';
    }

    // Warnings history
    html += '<div class="adm-detail-history">';
    html += `<h4>Avertissements (${warnings?.length || 0})</h4>`;
    if (warnings?.length > 0) {
        html += '<div class="adm-history-list">';
        warnings.forEach(w => {
            const date = new Date(w.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            html += `<div class="adm-history-item adm-history-warn">`;
            html += `<span class="adm-history-date">${date}</span>`;
            html += `<span class="adm-history-by">par ${escapeHtml(w.issuer?.username || '?')}</span>`;
            html += `<span class="adm-history-reason">${escapeHtml(w.reason)}</span>`;
            html += `</div>`;
        });
        html += '</div>';
    } else {
        html += '<p class="adm-empty">Aucun avertissement</p>';
    }

    // Bans history
    html += `<h4>Bans (${bans?.length || 0})</h4>`;
    if (bans?.length > 0) {
        html += '<div class="adm-history-list">';
        bans.forEach(b => {
            const date = new Date(b.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const status = b.active ? '<span class="adm-status-active">Actif</span>' : '<span class="adm-status-expired">Expire</span>';
            const expiry = b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Permanent';
            html += `<div class="adm-history-item adm-history-ban">${status} ${date} — ${expiry}`;
            html += `<span class="adm-history-reason">${escapeHtml(b.reason)}</span></div>`;
        });
        html += '</div>';
    } else {
        html += '<p class="adm-empty">Aucun ban</p>';
    }

    // Mutes history
    html += `<h4>Mutes (${mutes?.length || 0})</h4>`;
    if (mutes?.length > 0) {
        html += '<div class="adm-history-list">';
        mutes.forEach(m => {
            const date = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const status = m.active ? '<span class="adm-status-active">Actif</span>' : '<span class="adm-status-expired">Expire</span>';
            html += `<div class="adm-history-item adm-history-mute">${status} ${date}`;
            html += `<span class="adm-history-reason">${escapeHtml(m.reason)}</span></div>`;
        });
        html += '</div>';
    } else {
        html += '<p class="adm-empty">Aucun mute</p>';
    }

    html += '</div>'; // history
    html += '</div>'; // detail-card

    container.innerHTML = html;

    // Wire action buttons
    container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleUserAction(btn.dataset.action, user.id));
    });
}

async function handleUserAction(action, userId) {
    try {
        switch (action) {
            case 'warn': {
                const reason = prompt('Raison de l\'avertissement:');
                if (!reason) return;
                await warnUser(userId, reason);
                showToast('Avertissement envoye', 'success');
                break;
            }
            case 'mute': {
                const reason = prompt('Raison du mute:');
                if (!reason) return;
                const duration = prompt('Duree (ex: 30m, 1h, 24h):', '1h');
                if (!duration) return;
                await muteUser(userId, reason, duration);
                showToast('Joueur mute', 'success');
                break;
            }
            case 'ban': {
                const reason = prompt('Raison du ban temporaire:');
                if (!reason) return;
                const duration = prompt('Duree (ex: 1h, 1d, 7d):', '1d');
                if (!duration) return;
                await banUser(userId, reason, duration);
                showToast('Joueur banni', 'success');
                kickUser(userId);
                break;
            }
            case 'permban': {
                const reason = prompt('Raison du ban permanent:');
                if (!reason) return;
                if (!confirm('Confirmer le ban permanent?')) return;
                await banUser(userId, reason, null);
                showToast('Joueur banni definitivement', 'success');
                kickUser(userId);
                break;
            }
            case 'kick': {
                kickUser(userId);
                showToast('Joueur kick', 'success');
                break;
            }
            case 'unban': {
                await unbanUser(userId);
                showToast('Joueur unbanned', 'success');
                break;
            }
            case 'unmute': {
                await unmuteUser(userId);
                showToast('Joueur unmuted', 'success');
                break;
            }
            case 'gold-10k': {
                await addGoldToUser(userId, 10000);
                showToast('+10K gold', 'success');
                break;
            }
            case 'gold-100k': {
                await addGoldToUser(userId, 100000);
                showToast('+100K gold', 'success');
                break;
            }
            case 'essence-1k': {
                await addEssenceToUser(userId, 1000);
                showToast('+1K essence', 'success');
                break;
            }
            case 'essence-10k': {
                await addEssenceToUser(userId, 10000);
                showToast('+10K essence', 'success');
                break;
            }
            case 'diamond-100': {
                await addDiamondsToUser(userId, 100);
                showToast('+100 diamants', 'success');
                break;
            }
            case 'diamond-1k': {
                await addDiamondsToUser(userId, 1000);
                showToast('+1K diamants', 'success');
                break;
            }
            case 'set-role': {
                const select = document.getElementById('adm-role-select');
                if (!select) return;
                const role = select.value;
                if (!confirm(`Changer le role en "${role}"?`)) return;
                await setUserRole(userId, role);
                showToast(`Role change: ${role}`, 'success');
                break;
            }
            case 'reset': {
                if (!confirm('Reinitialiser l\'etat du joueur? Irreversible!')) return;
                await resetUserState(userId);
                showToast('Etat reinitialise', 'success');
                break;
            }
        }
        // Reload user detail
        loadPlayerDetail(userId);
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
    }
}

// ─── Stats Section ───────────────────────────────────────────────
async function loadStats() {
    const container = document.getElementById('adm-stats-content');
    container.innerHTML = '<p class="adm-loading">Chargement des statistiques...</p>';

    try {
        const stats = await getServerStats();
        container.innerHTML =
            '<div class="adm-stats-grid">' +
                `<div class="adm-stats-card">` +
                    `<div class="adm-stats-value">${stats.totalUsers}</div>` +
                    `<div class="adm-stats-label">Joueurs Total</div>` +
                `</div>` +
                `<div class="adm-stats-card">` +
                    `<div class="adm-stats-value">${stats.registeredUsers}</div>` +
                    `<div class="adm-stats-label">Inscrits</div>` +
                `</div>` +
                `<div class="adm-stats-card">` +
                    `<div class="adm-stats-value">${stats.totalGuests}</div>` +
                    `<div class="adm-stats-label">Invites</div>` +
                `</div>` +
                `<div class="adm-stats-card">` +
                    `<div class="adm-stats-value">${stats.totalGoldInCirculation.toLocaleString()}</div>` +
                    `<div class="adm-stats-label">Gold en Circulation</div>` +
                `</div>` +
                `<div class="adm-stats-card">` +
                    `<div class="adm-stats-value">${stats.totalEssenceInCirculation.toLocaleString()}</div>` +
                    `<div class="adm-stats-label">Essence en Circulation</div>` +
                `</div>` +
                `<div class="adm-stats-card">` +
                    `<div class="adm-stats-value">${(stats.totalDiamondsInCirculation || 0).toLocaleString()}</div>` +
                    `<div class="adm-stats-label">Diamants en Circulation</div>` +
                `</div>` +
            '</div>';
    } catch (err) {
        container.innerHTML = `<p class="adm-error">Erreur: ${escapeHtml(err.message)}</p>`;
    }
}

function initStatsSection() {
    document.getElementById('adm-stats-refresh')?.addEventListener('click', loadStats);
}

// ─── Logs Section ────────────────────────────────────────────────
async function loadLogs() {
    const container = document.getElementById('adm-logs-content');
    container.innerHTML = '<p class="adm-loading">Chargement des logs...</p>';

    try {
        const data = await getAuditLog(logsPage);
        let html = '';

        if (data.logs.length === 0) {
            html = '<p class="adm-empty">Aucun log</p>';
        } else {
            html += '<div class="adm-logs-table-wrap">';
            html += '<table class="adm-logs-table">';
            html += '<thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Details</th></tr></thead>';
            html += '<tbody>';
            data.logs.forEach(log => {
                const date = new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const details = log.details ? JSON.stringify(log.details).slice(0, 120) : '-';
                html += `<tr>`;
                html += `<td>${date}</td>`;
                html += `<td>${escapeHtml(log.actor?.username || '?')}</td>`;
                html += `<td><span class="adm-action-badge">${escapeHtml(log.action)}</span></td>`;
                html += `<td>${log.targetId || '-'}</td>`;
                html += `<td class="adm-log-details">${escapeHtml(details)}</td>`;
                html += `</tr>`;
            });
            html += '</tbody></table>';
            html += '</div>';

            // Pagination
            html += '<div class="adm-pagination">';
            html += `<button class="adm-btn adm-btn-secondary" id="adm-logs-prev" ${data.page <= 1 ? 'disabled' : ''}>Precedent</button>`;
            html += `<span class="adm-page-info">Page ${data.page} / ${data.pages}</span>`;
            html += `<button class="adm-btn adm-btn-secondary" id="adm-logs-next" ${data.page >= data.pages ? 'disabled' : ''}>Suivant</button>`;
            html += '</div>';
        }

        container.innerHTML = html;

        document.getElementById('adm-logs-prev')?.addEventListener('click', () => {
            if (logsPage > 1) { logsPage--; loadLogs(); }
        });
        document.getElementById('adm-logs-next')?.addEventListener('click', () => {
            if (logsPage < data.pages) { logsPage++; loadLogs(); }
        });
    } catch (err) {
        container.innerHTML = `<p class="adm-error">Erreur: ${escapeHtml(err.message)}</p>`;
    }
}

// ─── Equipment Section ───────────────────────────────────────────

// Sprite sheet file mapping (type → asset URL)
const EQUIP_TYPE_FILES = {
    hat: '/assets/helmets.png',
    weapon: '/assets/weapons.png',
    armor: '/assets/armors.png',
    necklace: '/assets/necklaces.png',
    ring: '/assets/rings.png',
    gloves: '/assets/gloves.png',
    belt: '/assets/belts.png',
    boots: '/assets/boots.png',
};

let allItems = [];
let spriteSheets = [];
let spriteEditorState = {
    img: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    selecting: false,
    selStartX: 0,
    selStartY: 0,
    selEndX: 0,
    selEndY: 0,
    panning: false,
    panStartX: 0,
    panStartY: 0,
};

async function fetchEquipmentItems() {
    const res = await apiFetch('/api/equipment/admin/items');
    if (!res.ok) throw new Error('Chargement echoue');
    const data = await res.json();
    allItems = data.items;
    return allItems;
}

async function fetchSpriteSheets() {
    const res = await apiFetch('/api/equipment/admin/sprite-sheets');
    if (!res.ok) throw new Error('Chargement sprite sheets echoue');
    const data = await res.json();
    spriteSheets = data.sheets;
    return spriteSheets;
}

function getFilteredItems() {
    const typeFilter = document.getElementById('adm-equip-filter-type')?.value;
    const tierFilter = document.getElementById('adm-equip-filter-tier')?.value;
    let items = allItems;
    if (typeFilter) items = items.filter(i => i.type === typeFilter);
    if (tierFilter) items = items.filter(i => i.tier === parseInt(tierFilter));
    return items;
}

function renderEquipmentList() {
    const container = document.getElementById('adm-equip-list');
    const items = getFilteredItems();

    if (items.length === 0) {
        container.innerHTML = '<p class="adm-empty">Aucun equipement trouve.</p>';
        return;
    }

    // Group by type then tier
    const grouped = {};
    items.forEach(item => {
        const key = `${item.type}`;
        if (!grouped[key]) grouped[key] = {};
        if (!grouped[key][item.tier]) grouped[key][item.tier] = [];
        grouped[key][item.tier].push(item);
    });

    let html = '';
    for (const type of Object.keys(grouped).sort()) {
        html += `<div class="adm-equip-type-group">`;
        html += `<h3 class="adm-equip-type-title">${escapeHtml(type)}</h3>`;

        const tiers = grouped[type];
        for (const tier of Object.keys(tiers).sort((a, b) => a - b)) {
            html += `<div class="adm-equip-tier-group">`;
            html += `<h4 class="adm-equip-tier-title">Tier ${tier}</h4>`;
            html += `<div class="adm-equip-grid">`;

            for (const item of tiers[tier]) {
                const spriteCSS = buildSpriteCSS(item);
                html += `<div class="adm-equip-card" data-item-id="${item.id}">`;
                html += `<div class="adm-equip-card-sprite" style="${spriteCSS}"></div>`;
                html += `<div class="adm-equip-card-info">`;
                html += `<span class="adm-equip-card-name">${escapeHtml(item.name)}</span>`;
                html += `<span class="adm-equip-card-skin">${escapeHtml(item.skin)}</span>`;
                html += `</div>`;
                html += `<div class="adm-equip-card-actions">`;
                html += `<button class="adm-btn adm-btn-secondary adm-btn-sm" data-edit-item="${item.id}">Modifier</button>`;
                html += `<button class="adm-btn adm-btn-danger adm-btn-sm" data-delete-item="${item.id}">Suppr.</button>`;
                html += `</div>`;
                html += `</div>`;
            }

            html += `</div></div>`;
        }
        html += `</div>`;
    }

    container.innerHTML = html;

    // Wire buttons
    container.querySelectorAll('[data-edit-item]').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.editItem)));
    });
    container.querySelectorAll('[data-delete-item]').forEach(btn => {
        btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.deleteItem)));
    });
}

function buildSpriteCSS(item) {
    const file = EQUIP_TYPE_FILES[item.type];
    if (!file || !item.spriteSheet) return '';
    const sheet = item.spriteSheet;
    const pad = 8;
    const x = Math.max(0, item.spriteX - pad);
    const y = Math.max(0, item.spriteY - pad);
    const w = Math.min(sheet.width - x, item.spriteW + pad * 2);
    const h = Math.min(sheet.height - y, item.spriteH + pad * 2);
    const sizeX = (sheet.width / w) * 100;
    const sizeY = (sheet.height / h) * 100;
    const posX = w < sheet.width ? (x / (sheet.width - w)) * 100 : 0;
    const posY = h < sheet.height ? (y / (sheet.height - h)) * 100 : 0;
    return `background-image: url(${file}); background-size: ${sizeX}% ${sizeY}%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`;
}

function openEditModal(itemId) {
    const modal = document.getElementById('adm-equip-modal');
    const title = document.getElementById('adm-equip-modal-title');

    if (itemId) {
        const item = allItems.find(i => i.id === itemId);
        if (!item) return;
        title.textContent = 'Modifier Equipement';
        document.getElementById('adm-equip-id').value = item.id;
        document.getElementById('adm-equip-type').value = item.type;
        document.getElementById('adm-equip-tier').value = item.tier;
        document.getElementById('adm-equip-skin').value = item.skin;
        document.getElementById('adm-equip-name').value = item.name;
        document.getElementById('adm-equip-sx').value = item.spriteX;
        document.getElementById('adm-equip-sy').value = item.spriteY;
        document.getElementById('adm-equip-sw').value = item.spriteW;
        document.getElementById('adm-equip-sh').value = item.spriteH;
    } else {
        title.textContent = 'Nouvel Equipement';
        document.getElementById('adm-equip-id').value = '';
        document.getElementById('adm-equip-form').reset();
    }

    modal.classList.remove('hidden');
    loadSpriteEditorImage();
    updateSpritePreview();
}

function closeEditModal() {
    document.getElementById('adm-equip-modal').classList.add('hidden');
}

async function saveItem(e) {
    e.preventDefault();
    const id = document.getElementById('adm-equip-id').value;
    const data = {
        type: document.getElementById('adm-equip-type').value,
        tier: parseInt(document.getElementById('adm-equip-tier').value),
        skin: document.getElementById('adm-equip-skin').value.trim(),
        name: document.getElementById('adm-equip-name').value.trim(),
        spriteX: parseInt(document.getElementById('adm-equip-sx').value),
        spriteY: parseInt(document.getElementById('adm-equip-sy').value),
        spriteW: parseInt(document.getElementById('adm-equip-sw').value),
        spriteH: parseInt(document.getElementById('adm-equip-sh').value),
    };

    try {
        if (id) {
            const res = await apiFetch(`/api/equipment/admin/items/${id}`, { method: 'PUT', body: data });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Echec');
            }
            showToast('Equipement mis a jour', 'success');
        } else {
            const res = await apiFetch('/api/equipment/admin/items', { method: 'POST', body: data });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Echec');
            }
            showToast('Equipement cree', 'success');
        }
        closeEditModal();
        await fetchEquipmentItems();
        renderEquipmentList();
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
    }
}

async function deleteItem(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    if (!confirm(`Supprimer "${item.name}" (${item.skin}) ?`)) return;

    try {
        const res = await apiFetch(`/api/equipment/admin/items/${itemId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Suppression echouee');
        showToast('Equipement supprime', 'success');
        await fetchEquipmentItems();
        renderEquipmentList();
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
    }
}

// ─── Interactive Sprite Editor ──────────────────────────────────

function loadSpriteEditorImage() {
    const type = document.getElementById('adm-equip-type').value;
    const file = EQUIP_TYPE_FILES[type];
    if (!file) return;

    const canvas = document.getElementById('adm-sprite-canvas');
    const ctx = canvas.getContext('2d');
    const wrap = document.getElementById('adm-sprite-canvas-wrap');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        spriteEditorState.img = img;
        spriteEditorState.zoom = 1;
        spriteEditorState.offsetX = 0;
        spriteEditorState.offsetY = 0;

        // Scale canvas to fit the wrapper width
        const wrapWidth = wrap.clientWidth || 800;
        const scale = wrapWidth / img.width;
        canvas.width = wrapWidth;
        canvas.height = img.height * scale;
        spriteEditorState.zoom = scale;

        drawSpriteEditor();
        drawSelectionFromInputs();
    };
    img.src = file;
}

function drawSpriteEditor() {
    const canvas = document.getElementById('adm-sprite-canvas');
    const ctx = canvas.getContext('2d');
    const { img, zoom, offsetX, offsetY } = spriteEditorState;
    if (!img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, img.width * zoom, img.height * zoom);
}

function drawSelectionFromInputs() {
    const sx = parseInt(document.getElementById('adm-equip-sx').value) || 0;
    const sy = parseInt(document.getElementById('adm-equip-sy').value) || 0;
    const sw = parseInt(document.getElementById('adm-equip-sw').value) || 0;
    const sh = parseInt(document.getElementById('adm-equip-sh').value) || 0;

    if (sw > 0 && sh > 0) {
        const { zoom, offsetX, offsetY } = spriteEditorState;
        const selEl = document.getElementById('adm-sprite-selection');
        selEl.style.left = (sx * zoom + offsetX) + 'px';
        selEl.style.top = (sy * zoom + offsetY) + 'px';
        selEl.style.width = (sw * zoom) + 'px';
        selEl.style.height = (sh * zoom) + 'px';
        selEl.style.display = 'block';
    }
}

function updateSpritePreview() {
    const type = document.getElementById('adm-equip-type').value;
    const file = EQUIP_TYPE_FILES[type];
    const preview = document.getElementById('adm-sprite-preview');
    if (!file || !preview) return;

    const sx = parseInt(document.getElementById('adm-equip-sx').value) || 0;
    const sy = parseInt(document.getElementById('adm-equip-sy').value) || 0;
    const sw = parseInt(document.getElementById('adm-equip-sw').value) || 0;
    const sh = parseInt(document.getElementById('adm-equip-sh').value) || 0;

    if (sw <= 0 || sh <= 0) {
        preview.style.backgroundImage = '';
        return;
    }

    // Find sheet dimensions
    const sheet = spriteSheets.find(s => s.type === type);
    const sheetW = sheet?.width || 1024;
    const sheetH = sheet?.height || 1536;

    const pad = 8;
    const x = Math.max(0, sx - pad);
    const y = Math.max(0, sy - pad);
    const w = Math.min(sheetW - x, sw + pad * 2);
    const h = Math.min(sheetH - y, sh + pad * 2);
    const sizeX = (sheetW / w) * 100;
    const sizeY = (sheetH / h) * 100;
    const posX = w < sheetW ? (x / (sheetW - w)) * 100 : 0;
    const posY = h < sheetH ? (y / (sheetH - h)) * 100 : 0;

    preview.style.backgroundImage = `url(${file})`;
    preview.style.backgroundSize = `${sizeX}% ${sizeY}%`;
    preview.style.backgroundPosition = `${posX}% ${posY}%`;
    preview.style.backgroundRepeat = 'no-repeat';
}

function initSpriteEditor() {
    const canvas = document.getElementById('adm-sprite-canvas');
    const selEl = document.getElementById('adm-sprite-selection');
    if (!canvas) return;

    // Mouse down: start selection
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.ctrlKey) {
            // Middle click or ctrl+click = pan
            spriteEditorState.panning = true;
            spriteEditorState.panStartX = e.clientX - spriteEditorState.offsetX;
            spriteEditorState.panStartY = e.clientY - spriteEditorState.offsetY;
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const { zoom, offsetX, offsetY } = spriteEditorState;
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // Convert to image coordinates
        const imgX = Math.round((canvasX - offsetX) / zoom);
        const imgY = Math.round((canvasY - offsetY) / zoom);

        spriteEditorState.selecting = true;
        spriteEditorState.selStartX = imgX;
        spriteEditorState.selStartY = imgY;
        spriteEditorState.selEndX = imgX;
        spriteEditorState.selEndY = imgY;

        selEl.style.display = 'block';
    });

    // Mouse move: update selection or pan
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const { zoom, offsetX, offsetY } = spriteEditorState;
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const imgX = Math.round((canvasX - offsetX) / zoom);
        const imgY = Math.round((canvasY - offsetY) / zoom);

        // Show current coords
        const coordsEl = document.getElementById('adm-sprite-coords');
        if (coordsEl) coordsEl.textContent = `x: ${imgX}, y: ${imgY}`;

        if (spriteEditorState.panning) {
            spriteEditorState.offsetX = e.clientX - spriteEditorState.panStartX;
            spriteEditorState.offsetY = e.clientY - spriteEditorState.panStartY;
            drawSpriteEditor();
            drawSelectionFromInputs();
            return;
        }

        if (!spriteEditorState.selecting) return;

        spriteEditorState.selEndX = imgX;
        spriteEditorState.selEndY = imgY;

        // Draw selection rectangle
        const sx = Math.min(spriteEditorState.selStartX, spriteEditorState.selEndX);
        const sy = Math.min(spriteEditorState.selStartY, spriteEditorState.selEndY);
        const sw = Math.abs(spriteEditorState.selEndX - spriteEditorState.selStartX);
        const sh = Math.abs(spriteEditorState.selEndY - spriteEditorState.selStartY);

        selEl.style.left = (sx * zoom + offsetX) + 'px';
        selEl.style.top = (sy * zoom + offsetY) + 'px';
        selEl.style.width = (sw * zoom) + 'px';
        selEl.style.height = (sh * zoom) + 'px';
    });

    // Mouse up: finalize selection
    const finishSelection = () => {
        if (spriteEditorState.panning) {
            spriteEditorState.panning = false;
            return;
        }
        if (!spriteEditorState.selecting) return;
        spriteEditorState.selecting = false;

        const sx = Math.min(spriteEditorState.selStartX, spriteEditorState.selEndX);
        const sy = Math.min(spriteEditorState.selStartY, spriteEditorState.selEndY);
        const sw = Math.abs(spriteEditorState.selEndX - spriteEditorState.selStartX);
        const sh = Math.abs(spriteEditorState.selEndY - spriteEditorState.selStartY);

        if (sw > 2 && sh > 2) {
            document.getElementById('adm-equip-sx').value = sx;
            document.getElementById('adm-equip-sy').value = sy;
            document.getElementById('adm-equip-sw').value = sw;
            document.getElementById('adm-equip-sh').value = sh;
            updateSpritePreview();
        }
    };
    canvas.addEventListener('mouseup', finishSelection);
    canvas.addEventListener('mouseleave', finishSelection);

    // Mouse wheel: zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const prevZoom = spriteEditorState.zoom;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        spriteEditorState.zoom = Math.max(0.1, Math.min(5, prevZoom * delta));

        // Zoom toward mouse position
        const zoomRatio = spriteEditorState.zoom / prevZoom;
        spriteEditorState.offsetX = mouseX - (mouseX - spriteEditorState.offsetX) * zoomRatio;
        spriteEditorState.offsetY = mouseY - (mouseY - spriteEditorState.offsetY) * zoomRatio;

        const img = spriteEditorState.img;
        if (img) {
            canvas.width = img.width * spriteEditorState.zoom + Math.abs(spriteEditorState.offsetX);
            canvas.height = img.height * spriteEditorState.zoom + Math.abs(spriteEditorState.offsetY);
        }

        drawSpriteEditor();
        drawSelectionFromInputs();
    });

    // Type change reloads the sprite sheet image
    document.getElementById('adm-equip-type')?.addEventListener('change', () => {
        loadSpriteEditorImage();
    });

    // Sprite coordinate inputs update selection and preview
    ['adm-equip-sx', 'adm-equip-sy', 'adm-equip-sw', 'adm-equip-sh'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            drawSpriteEditor();
            drawSelectionFromInputs();
            updateSpritePreview();
        });
    });
}

async function loadEquipmentSection() {
    const container = document.getElementById('adm-equip-list');
    container.innerHTML = '<p class="adm-loading">Chargement des equipements...</p>';
    try {
        await Promise.all([fetchEquipmentItems(), fetchSpriteSheets()]);
        renderEquipmentList();
    } catch (err) {
        container.innerHTML = `<p class="adm-error">Erreur: ${escapeHtml(err.message)}</p>`;
    }
}

function initEquipmentSection() {
    // Add button
    document.getElementById('adm-equip-add-btn')?.addEventListener('click', () => openEditModal(null));

    // Close modal
    document.getElementById('adm-equip-modal-close')?.addEventListener('click', closeEditModal);
    document.getElementById('adm-equip-cancel-btn')?.addEventListener('click', closeEditModal);

    // Save form
    document.getElementById('adm-equip-form')?.addEventListener('submit', saveItem);

    // Filters
    document.getElementById('adm-equip-filter-type')?.addEventListener('change', renderEquipmentList);
    document.getElementById('adm-equip-filter-tier')?.addEventListener('change', renderEquipmentList);

    // Sprite editor
    initSpriteEditor();
}

// ─── Broadcast Section ───────────────────────────────────────────
function initBroadcastSection() {
    document.getElementById('adm-broadcast-send')?.addEventListener('click', () => {
        const textarea = document.getElementById('adm-broadcast-text');
        const text = textarea?.value.trim();
        if (!text) {
            showToast('Le message ne peut pas etre vide', 'error');
            return;
        }
        broadcastMessage(text);
        showToast('Annonce envoyee', 'success');
        textarea.value = '';
    });
}

// ─── Role-based visibility ───────────────────────────────────────
function applyRoleVisibility() {
    const isAdm = currentUser.role === 'admin';

    // Hide admin-only sections for moderators
    if (!isAdm) {
        document.querySelectorAll('[data-section="stats"]').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('[data-section="equipment"]').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('[data-section="broadcast"]').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// ─── Init ────────────────────────────────────────────────────────
async function init() {
    const gateText = document.getElementById('adm-gate-text');

    // 1. Restore session
    const user = await restoreSession();
    if (!user) {
        gateText.textContent = 'Session invalide. Redirection...';
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return;
    }

    // 2. Check role
    if (user.role !== 'admin' && user.role !== 'moderator') {
        gateText.textContent = 'Acces refuse. Permissions insuffisantes.';
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return;
    }

    // 3. Store user and set up dashboard
    currentUser = user;

    // Set role badge
    const badgeText = user.role === 'admin' ? 'ADMIN' : 'MOD';
    document.getElementById('adm-role-badge').textContent = badgeText;
    document.getElementById('adm-role-badge-mobile').textContent = badgeText;
    const badgeClass = user.role === 'admin' ? 'adm-role-admin' : 'adm-role-moderator';
    document.getElementById('adm-role-badge').classList.add(badgeClass);
    document.getElementById('adm-role-badge-mobile').classList.add(badgeClass);

    // 4. Connect socket for kick/broadcast
    connectSocket();

    // 5. Show dashboard, hide gate
    document.getElementById('adm-gate').classList.add('hidden');
    document.getElementById('adm-dashboard').classList.remove('hidden');

    // 6. Init sections
    initNavigation();
    initPlayersSection();
    initStatsSection();
    initEquipmentSection();
    initBroadcastSection();
    applyRoleVisibility();
}

window.addEventListener('DOMContentLoaded', init);
