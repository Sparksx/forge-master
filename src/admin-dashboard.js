/**
 * Admin Dashboard — standalone page entry point.
 * Handles authentication, role-gating, and renders the full admin dashboard.
 */

import '../css/base.css';
import '../css/admin-dashboard.css';

import { setTokens, apiFetch, getAccessToken, getStoredRefreshToken, clearTokens } from './api.js';
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
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) clearTokens();
            return null;
        }

        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);

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

    // Hide stats section nav for moderators
    if (!isAdm) {
        document.querySelectorAll('[data-section="stats"]').forEach(el => {
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
    initBroadcastSection();
    applyRoleVisibility();
}

window.addEventListener('DOMContentLoaded', init);
