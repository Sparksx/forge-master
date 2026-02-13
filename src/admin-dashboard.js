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
        case 'sprites': loadSpritesSection(); break;
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

// ═════════════════════════════════════════════════════════════════
// SPRITES Section
// ═════════════════════════════════════════════════════════════════

// Sprite sheet file mapping (type → asset URL)
const SHEET_TYPE_FILES = {
    hat: '/assets/helmets.png',
    weapon: '/assets/weapons.png',
    armor: '/assets/armors.png',
    necklace: '/assets/necklaces.png',
    ring: '/assets/rings.png',
    gloves: '/assets/gloves.png',
    belt: '/assets/belts.png',
    boots: '/assets/boots.png',
};

let allSprites = [];
let spriteSheets = [];

async function fetchAllSprites() {
    const res = await apiFetch('/api/sprites/admin/list');
    if (!res.ok) throw new Error('Chargement sprites echoue');
    const data = await res.json();
    allSprites = data.sprites;
    return allSprites;
}

async function fetchSpriteSheets() {
    const res = await apiFetch('/api/equipment/admin/sprite-sheets');
    if (!res.ok) throw new Error('Chargement sprite sheets echoue');
    const data = await res.json();
    spriteSheets = data.sheets;
    return spriteSheets;
}

function buildSpriteCSSFromData(sheetFile, sheetW, sheetH, sx, sy, sw, sh) {
    if (!sheetFile || sw <= 0 || sh <= 0) return '';
    const sizeX = (sheetW / sw) * 100;
    const sizeY = (sheetH / sh) * 100;
    const posX = sw < sheetW ? (sx / (sheetW - sw)) * 100 : 0;
    const posY = sh < sheetH ? (sy / (sheetH - sh)) * 100 : 0;
    return `background-image: url(${sheetFile}); background-size: ${sizeX}% ${sizeY}%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`;
}

function buildSpriteCSSFromSprite(sprite) {
    if (!sprite || !sprite.spriteSheet) return '';
    const sheet = sprite.spriteSheet;
    const file = SHEET_TYPE_FILES[sheet.type] || sheet.file;
    return buildSpriteCSSFromData(file, sheet.width, sheet.height, sprite.spriteX, sprite.spriteY, sprite.spriteW, sprite.spriteH);
}

function getFilteredSprites() {
    const sheetFilter = document.getElementById('adm-sprite-filter-sheet')?.value;
    let sprites = allSprites;
    if (sheetFilter) sprites = sprites.filter(s => s.spriteSheetId === parseInt(sheetFilter));
    return sprites;
}

function renderSpriteList() {
    const container = document.getElementById('adm-sprite-list');
    const sprites = getFilteredSprites();

    if (sprites.length === 0) {
        container.innerHTML = '<p class="adm-empty">Aucun sprite trouve.</p>';
        return;
    }

    // Group by sheet type
    const grouped = {};
    sprites.forEach(spr => {
        const type = spr.spriteSheet?.type || 'unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(spr);
    });

    let html = '';
    for (const type of Object.keys(grouped).sort()) {
        html += `<div class="adm-equip-type-group">`;
        html += `<h3 class="adm-equip-type-title">${escapeHtml(type)}</h3>`;
        html += `<div class="adm-equip-grid">`;

        for (const spr of grouped[type]) {
            const spriteCSS = buildSpriteCSSFromSprite(spr);
            const usageCount = spr._count?.items || 0;
            html += `<div class="adm-equip-card" data-sprite-id="${spr.id}">`;
            html += `<div class="adm-equip-card-sprite" style="${spriteCSS}"></div>`;
            html += `<div class="adm-equip-card-info">`;
            html += `<span class="adm-equip-card-name">${escapeHtml(spr.name)}</span>`;
            html += `<span class="adm-equip-card-skin">${spr.spriteX},${spr.spriteY} ${spr.spriteW}x${spr.spriteH}</span>`;
            if (usageCount > 0) {
                html += `<span class="adm-equip-card-skin">${usageCount} equip.</span>`;
            }
            html += `</div>`;
            html += `<div class="adm-equip-card-actions">`;
            html += `<button class="adm-btn adm-btn-secondary adm-btn-sm" data-edit-sprite="${spr.id}">Modifier</button>`;
            html += `<button class="adm-btn adm-btn-danger adm-btn-sm" data-delete-sprite="${spr.id}">Suppr.</button>`;
            html += `</div>`;
            html += `</div>`;
        }

        html += `</div></div>`;
    }

    container.innerHTML = html;

    // Wire buttons
    container.querySelectorAll('[data-edit-sprite]').forEach(btn => {
        btn.addEventListener('click', () => openSpriteModal(parseInt(btn.dataset.editSprite)));
    });
    container.querySelectorAll('[data-delete-sprite]').forEach(btn => {
        btn.addEventListener('click', () => deleteSprite(parseInt(btn.dataset.deleteSprite)));
    });
}

async function deleteSprite(spriteId) {
    const spr = allSprites.find(s => s.id === spriteId);
    if (!spr) return;
    if (!confirm(`Supprimer le sprite "${spr.name}" ?`)) return;

    try {
        const res = await apiFetch(`/api/sprites/admin/${spriteId}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || 'Suppression echouee');
        }
        showToast('Sprite supprime', 'success');
        await fetchAllSprites();
        renderSpriteList();
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
    }
}

// ─── Sprite Editor State ─────────────────────────────────────────
let sprEditorState = {
    img: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    // Interaction modes
    mode: 'none', // 'none' | 'selecting' | 'moving' | 'resizing' | 'panning'
    resizeHandle: null, // 'nw' | 'ne' | 'sw' | 'se'
    // Selection in image coordinates
    selX: 0,
    selY: 0,
    selW: 0,
    selH: 0,
    // Drag start
    dragStartMouseX: 0,
    dragStartMouseY: 0,
    dragStartSelX: 0,
    dragStartSelY: 0,
    dragStartSelW: 0,
    dragStartSelH: 0,
    // Pan start
    panStartX: 0,
    panStartY: 0,
};

function openSpriteModal(spriteId) {
    const modal = document.getElementById('adm-sprite-modal');
    const title = document.getElementById('adm-sprite-modal-title');

    // Populate sheet dropdown
    const sheetSelect = document.getElementById('adm-spr-sheet');
    sheetSelect.innerHTML = '';
    spriteSheets.forEach(s => {
        sheetSelect.innerHTML += `<option value="${s.id}">${escapeHtml(s.type)} (${s.file})</option>`;
    });

    if (spriteId) {
        const spr = allSprites.find(s => s.id === spriteId);
        if (!spr) return;
        title.textContent = 'Modifier Sprite';
        document.getElementById('adm-spr-id').value = spr.id;
        document.getElementById('adm-spr-name').value = spr.name;
        document.getElementById('adm-spr-sheet').value = spr.spriteSheetId;
        document.getElementById('adm-spr-sx').value = spr.spriteX;
        document.getElementById('adm-spr-sy').value = spr.spriteY;
        document.getElementById('adm-spr-sw').value = spr.spriteW;
        document.getElementById('adm-spr-sh').value = spr.spriteH;
    } else {
        title.textContent = 'Nouveau Sprite';
        document.getElementById('adm-spr-id').value = '';
        document.getElementById('adm-sprite-form').reset();
        if (spriteSheets.length > 0) {
            sheetSelect.value = spriteSheets[0].id;
        }
    }

    modal.classList.remove('hidden');
    loadSprEditorImage();
    updateSprPreview();
}

function closeSpriteModal() {
    document.getElementById('adm-sprite-modal').classList.add('hidden');
}

async function saveSpriteForm(e) {
    e.preventDefault();
    const id = document.getElementById('adm-spr-id').value;
    const data = {
        name: document.getElementById('adm-spr-name').value.trim(),
        spriteSheetId: parseInt(document.getElementById('adm-spr-sheet').value),
        spriteX: parseInt(document.getElementById('adm-spr-sx').value),
        spriteY: parseInt(document.getElementById('adm-spr-sy').value),
        spriteW: parseInt(document.getElementById('adm-spr-sw').value),
        spriteH: parseInt(document.getElementById('adm-spr-sh').value),
    };

    try {
        if (id) {
            const res = await apiFetch(`/api/sprites/admin/${id}`, { method: 'PUT', body: data });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Echec');
            }
            showToast('Sprite mis a jour', 'success');
        } else {
            const res = await apiFetch('/api/sprites/admin', { method: 'POST', body: data });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Echec');
            }
            showToast('Sprite cree', 'success');
        }
        closeSpriteModal();
        await fetchAllSprites();
        renderSpriteList();
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
    }
}

// ─── Interactive Sprite Editor (with move + resize) ──────────────

function getSheetForEditor() {
    const sheetId = parseInt(document.getElementById('adm-spr-sheet').value);
    return spriteSheets.find(s => s.id === sheetId);
}

function loadSprEditorImage() {
    const sheet = getSheetForEditor();
    if (!sheet) return;
    const file = SHEET_TYPE_FILES[sheet.type] || sheet.file;

    const canvas = document.getElementById('adm-spr-canvas');
    const wrap = document.getElementById('adm-spr-canvas-wrap');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        sprEditorState.img = img;
        sprEditorState.offsetX = 0;
        sprEditorState.offsetY = 0;

        const wrapWidth = wrap.clientWidth || 800;
        const scale = wrapWidth / img.width;
        canvas.width = wrapWidth;
        canvas.height = img.height * scale;
        sprEditorState.zoom = scale;

        drawSprEditor();
        syncSelectionFromInputs();
        zoomToSelection();
    };
    img.src = file;
}

function zoomToSelection() {
    const { selX, selY, selW, selH } = sprEditorState;
    if (selW <= 0 || selH <= 0) return;

    const canvas = document.getElementById('adm-spr-canvas');
    const wrap = document.getElementById('adm-spr-canvas-wrap');
    if (!canvas || !wrap || !sprEditorState.img) return;

    const img = sprEditorState.img;
    const wrapWidth = wrap.clientWidth || 800;
    const viewH = 500;

    // Zoom so selection fills ~50% of the viewport
    const margin = 2.0;
    const zoomX = wrapWidth / (selW * margin);
    const zoomY = viewH / (selH * margin);
    const zoom = Math.min(zoomX, zoomY, 5);

    const fullScale = wrapWidth / img.width;
    sprEditorState.zoom = Math.max(fullScale, zoom);

    // Center selection in the viewport
    const offsetX = wrapWidth / 2 - (selX + selW / 2) * sprEditorState.zoom;
    const offsetY = viewH / 2 - (selY + selH / 2) * sprEditorState.zoom;
    sprEditorState.offsetX = offsetX;
    sprEditorState.offsetY = offsetY;

    canvas.width = Math.max(wrapWidth, img.width * sprEditorState.zoom + Math.abs(offsetX));
    canvas.height = Math.max(viewH, img.height * sprEditorState.zoom + Math.abs(offsetY));

    drawSprEditor();
    updateSelectionOverlay();
}

function drawSprEditor() {
    const canvas = document.getElementById('adm-spr-canvas');
    const ctx = canvas.getContext('2d');
    const { img, zoom, offsetX, offsetY } = sprEditorState;
    if (!img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, img.width * zoom, img.height * zoom);
}

function syncSelectionFromInputs() {
    const sx = parseInt(document.getElementById('adm-spr-sx').value) || 0;
    const sy = parseInt(document.getElementById('adm-spr-sy').value) || 0;
    const sw = parseInt(document.getElementById('adm-spr-sw').value) || 0;
    const sh = parseInt(document.getElementById('adm-spr-sh').value) || 0;

    sprEditorState.selX = sx;
    sprEditorState.selY = sy;
    sprEditorState.selW = sw;
    sprEditorState.selH = sh;

    updateSelectionOverlay();
}

function updateSelectionOverlay() {
    const { selX, selY, selW, selH, zoom, offsetX, offsetY } = sprEditorState;
    const selEl = document.getElementById('adm-spr-selection');

    if (selW > 0 && selH > 0) {
        selEl.style.left = (selX * zoom + offsetX) + 'px';
        selEl.style.top = (selY * zoom + offsetY) + 'px';
        selEl.style.width = (selW * zoom) + 'px';
        selEl.style.height = (selH * zoom) + 'px';
        selEl.style.display = 'block';
    } else {
        selEl.style.display = 'none';
    }
}

function syncInputsFromSelection() {
    const { selX, selY, selW, selH } = sprEditorState;
    document.getElementById('adm-spr-sx').value = Math.round(selX);
    document.getElementById('adm-spr-sy').value = Math.round(selY);
    document.getElementById('adm-spr-sw').value = Math.round(selW);
    document.getElementById('adm-spr-sh').value = Math.round(selH);
    updateSprPreview();
}

function updateSprPreview() {
    const sheet = getSheetForEditor();
    const preview = document.getElementById('adm-spr-preview');
    if (!sheet || !preview) return;

    const file = SHEET_TYPE_FILES[sheet.type] || sheet.file;
    const sx = parseInt(document.getElementById('adm-spr-sx').value) || 0;
    const sy = parseInt(document.getElementById('adm-spr-sy').value) || 0;
    const sw = parseInt(document.getElementById('adm-spr-sw').value) || 0;
    const sh = parseInt(document.getElementById('adm-spr-sh').value) || 0;

    if (sw <= 0 || sh <= 0) {
        preview.style.backgroundImage = '';
        return;
    }

    const css = buildSpriteCSSFromData(file, sheet.width, sheet.height, sx, sy, sw, sh);
    preview.setAttribute('style', css);
}

function screenToImage(clientX, clientY) {
    const canvas = document.getElementById('adm-spr-canvas');
    const rect = canvas.getBoundingClientRect();
    const { zoom, offsetX, offsetY } = sprEditorState;
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    return {
        x: (canvasX - offsetX) / zoom,
        y: (canvasY - offsetY) / zoom,
    };
}

function hitTestHandle(clientX, clientY) {
    const { selX, selY, selW, selH, zoom, offsetX, offsetY } = sprEditorState;
    if (selW <= 0 || selH <= 0) return null;

    const canvas = document.getElementById('adm-spr-canvas');
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const handleSize = 10;
    const corners = {
        nw: { x: selX * zoom + offsetX, y: selY * zoom + offsetY },
        ne: { x: (selX + selW) * zoom + offsetX, y: selY * zoom + offsetY },
        sw: { x: selX * zoom + offsetX, y: (selY + selH) * zoom + offsetY },
        se: { x: (selX + selW) * zoom + offsetX, y: (selY + selH) * zoom + offsetY },
    };

    for (const [handle, pos] of Object.entries(corners)) {
        if (Math.abs(mx - pos.x) <= handleSize && Math.abs(my - pos.y) <= handleSize) {
            return handle;
        }
    }
    return null;
}

function hitTestSelection(clientX, clientY) {
    const { selX, selY, selW, selH, zoom, offsetX, offsetY } = sprEditorState;
    if (selW <= 0 || selH <= 0) return false;

    const canvas = document.getElementById('adm-spr-canvas');
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const screenX = selX * zoom + offsetX;
    const screenY = selY * zoom + offsetY;
    const screenW = selW * zoom;
    const screenH = selH * zoom;

    return mx >= screenX && mx <= screenX + screenW && my >= screenY && my <= screenY + screenH;
}

function initSpriteEditor() {
    const canvas = document.getElementById('adm-spr-canvas');
    const wrap = document.getElementById('adm-spr-canvas-wrap');
    if (!canvas || !wrap) return;

    // Mouse down on the canvas wrapper (captures events on selection overlay too)
    wrap.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.ctrlKey) {
            // Middle click or ctrl+click = pan
            sprEditorState.mode = 'panning';
            sprEditorState.panStartX = e.clientX - sprEditorState.offsetX;
            sprEditorState.panStartY = e.clientY - sprEditorState.offsetY;
            e.preventDefault();
            return;
        }

        if (e.button !== 0) return;

        const imgPos = screenToImage(e.clientX, e.clientY);

        // Check if clicking a resize handle
        const handle = hitTestHandle(e.clientX, e.clientY);
        if (handle) {
            sprEditorState.mode = 'resizing';
            sprEditorState.resizeHandle = handle;
            sprEditorState.dragStartMouseX = imgPos.x;
            sprEditorState.dragStartMouseY = imgPos.y;
            sprEditorState.dragStartSelX = sprEditorState.selX;
            sprEditorState.dragStartSelY = sprEditorState.selY;
            sprEditorState.dragStartSelW = sprEditorState.selW;
            sprEditorState.dragStartSelH = sprEditorState.selH;
            e.preventDefault();
            return;
        }

        // Check if clicking inside the selection (move)
        if (hitTestSelection(e.clientX, e.clientY)) {
            sprEditorState.mode = 'moving';
            sprEditorState.dragStartMouseX = imgPos.x;
            sprEditorState.dragStartMouseY = imgPos.y;
            sprEditorState.dragStartSelX = sprEditorState.selX;
            sprEditorState.dragStartSelY = sprEditorState.selY;
            e.preventDefault();
            return;
        }

        // Otherwise: create new selection
        sprEditorState.mode = 'selecting';
        sprEditorState.selX = imgPos.x;
        sprEditorState.selY = imgPos.y;
        sprEditorState.selW = 0;
        sprEditorState.selH = 0;
        sprEditorState.dragStartMouseX = imgPos.x;
        sprEditorState.dragStartMouseY = imgPos.y;

        const selEl = document.getElementById('adm-spr-selection');
        selEl.style.display = 'block';
    });

    // Mouse move
    wrap.addEventListener('mousemove', (e) => {
        const imgPos = screenToImage(e.clientX, e.clientY);

        // Update cursor based on hover
        if (sprEditorState.mode === 'none') {
            const handle = hitTestHandle(e.clientX, e.clientY);
            if (handle) {
                wrap.style.cursor = handle + '-resize';
            } else if (hitTestSelection(e.clientX, e.clientY)) {
                wrap.style.cursor = 'move';
            } else {
                wrap.style.cursor = 'crosshair';
            }
        }

        // Show coordinates
        const coordsEl = document.getElementById('adm-spr-coords');
        if (coordsEl) coordsEl.textContent = `x: ${Math.round(imgPos.x)}, y: ${Math.round(imgPos.y)}`;

        if (sprEditorState.mode === 'panning') {
            sprEditorState.offsetX = e.clientX - sprEditorState.panStartX;
            sprEditorState.offsetY = e.clientY - sprEditorState.panStartY;
            drawSprEditor();
            updateSelectionOverlay();
            return;
        }

        if (sprEditorState.mode === 'selecting') {
            const endX = imgPos.x;
            const endY = imgPos.y;
            sprEditorState.selX = Math.min(sprEditorState.dragStartMouseX, endX);
            sprEditorState.selY = Math.min(sprEditorState.dragStartMouseY, endY);
            sprEditorState.selW = Math.abs(endX - sprEditorState.dragStartMouseX);
            sprEditorState.selH = Math.abs(endY - sprEditorState.dragStartMouseY);
            updateSelectionOverlay();
            return;
        }

        if (sprEditorState.mode === 'moving') {
            const dx = imgPos.x - sprEditorState.dragStartMouseX;
            const dy = imgPos.y - sprEditorState.dragStartMouseY;
            sprEditorState.selX = Math.max(0, sprEditorState.dragStartSelX + dx);
            sprEditorState.selY = Math.max(0, sprEditorState.dragStartSelY + dy);
            updateSelectionOverlay();
            return;
        }

        if (sprEditorState.mode === 'resizing') {
            const dx = imgPos.x - sprEditorState.dragStartMouseX;
            const dy = imgPos.y - sprEditorState.dragStartMouseY;
            const { dragStartSelX, dragStartSelY, dragStartSelW, dragStartSelH, resizeHandle } = sprEditorState;

            let newX = dragStartSelX;
            let newY = dragStartSelY;
            let newW = dragStartSelW;
            let newH = dragStartSelH;

            if (resizeHandle === 'nw') {
                newX = dragStartSelX + dx;
                newY = dragStartSelY + dy;
                newW = dragStartSelW - dx;
                newH = dragStartSelH - dy;
            } else if (resizeHandle === 'ne') {
                newY = dragStartSelY + dy;
                newW = dragStartSelW + dx;
                newH = dragStartSelH - dy;
            } else if (resizeHandle === 'sw') {
                newX = dragStartSelX + dx;
                newW = dragStartSelW - dx;
                newH = dragStartSelH + dy;
            } else if (resizeHandle === 'se') {
                newW = dragStartSelW + dx;
                newH = dragStartSelH + dy;
            }

            // Ensure minimum size
            if (newW < 2) { newW = 2; newX = dragStartSelX + dragStartSelW - 2; }
            if (newH < 2) { newH = 2; newY = dragStartSelY + dragStartSelH - 2; }
            newX = Math.max(0, newX);
            newY = Math.max(0, newY);

            sprEditorState.selX = newX;
            sprEditorState.selY = newY;
            sprEditorState.selW = newW;
            sprEditorState.selH = newH;
            updateSelectionOverlay();
            return;
        }
    });

    // Mouse up: finalize any interaction
    const finishInteraction = () => {
        const prevMode = sprEditorState.mode;
        sprEditorState.mode = 'none';

        if (prevMode === 'panning') return;

        if (prevMode === 'selecting') {
            // Only commit if selection is meaningful
            if (sprEditorState.selW > 2 && sprEditorState.selH > 2) {
                sprEditorState.selX = Math.round(sprEditorState.selX);
                sprEditorState.selY = Math.round(sprEditorState.selY);
                sprEditorState.selW = Math.round(sprEditorState.selW);
                sprEditorState.selH = Math.round(sprEditorState.selH);
                syncInputsFromSelection();
            }
            return;
        }

        if (prevMode === 'moving' || prevMode === 'resizing') {
            sprEditorState.selX = Math.round(sprEditorState.selX);
            sprEditorState.selY = Math.round(sprEditorState.selY);
            sprEditorState.selW = Math.round(sprEditorState.selW);
            sprEditorState.selH = Math.round(sprEditorState.selH);
            syncInputsFromSelection();
            updateSelectionOverlay();
        }
    };

    wrap.addEventListener('mouseup', finishInteraction);
    wrap.addEventListener('mouseleave', finishInteraction);

    // Mouse wheel: zoom
    wrap.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const prevZoom = sprEditorState.zoom;
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        sprEditorState.zoom = Math.max(0.1, Math.min(5, prevZoom * delta));

        // Zoom toward mouse position
        const zoomRatio = sprEditorState.zoom / prevZoom;
        sprEditorState.offsetX = mouseX - (mouseX - sprEditorState.offsetX) * zoomRatio;
        sprEditorState.offsetY = mouseY - (mouseY - sprEditorState.offsetY) * zoomRatio;

        const img = sprEditorState.img;
        if (img) {
            canvas.width = Math.max(canvas.parentElement.clientWidth, img.width * sprEditorState.zoom + Math.abs(sprEditorState.offsetX));
            canvas.height = Math.max(200, img.height * sprEditorState.zoom + Math.abs(sprEditorState.offsetY));
        }

        drawSprEditor();
        updateSelectionOverlay();
    });

    // Sheet change reloads image
    document.getElementById('adm-spr-sheet')?.addEventListener('change', () => {
        loadSprEditorImage();
    });

    // Coordinate inputs update the selection and preview
    ['adm-spr-sx', 'adm-spr-sy', 'adm-spr-sw', 'adm-spr-sh'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            syncSelectionFromInputs();
            drawSprEditor();
            updateSprPreview();
        });
    });
}

async function loadSpritesSection() {
    const container = document.getElementById('adm-sprite-list');
    container.innerHTML = '<p class="adm-loading">Chargement des sprites...</p>';
    try {
        await Promise.all([fetchAllSprites(), fetchSpriteSheets()]);

        // Populate sheet filter dropdown
        const filterSelect = document.getElementById('adm-sprite-filter-sheet');
        filterSelect.innerHTML = '<option value="">Toutes les feuilles</option>';
        spriteSheets.forEach(s => {
            filterSelect.innerHTML += `<option value="${s.id}">${escapeHtml(s.type)}</option>`;
        });

        renderSpriteList();
    } catch (err) {
        container.innerHTML = `<p class="adm-error">Erreur: ${escapeHtml(err.message)}</p>`;
    }
}

function initSpritesSection() {
    document.getElementById('adm-sprite-add-btn')?.addEventListener('click', () => openSpriteModal(null));
    document.getElementById('adm-sprite-modal-close')?.addEventListener('click', closeSpriteModal);
    document.getElementById('adm-sprite-cancel-btn')?.addEventListener('click', closeSpriteModal);
    document.getElementById('adm-sprite-form')?.addEventListener('submit', saveSpriteForm);
    document.getElementById('adm-sprite-filter-sheet')?.addEventListener('change', renderSpriteList);

    initSpriteEditor();
}

// ═════════════════════════════════════════════════════════════════
// EQUIPMENT Section (updated to use Sprite references)
// ═════════════════════════════════════════════════════════════════

let allItems = [];

async function fetchEquipmentItems() {
    const res = await apiFetch('/api/equipment/admin/items');
    if (!res.ok) throw new Error('Chargement echoue');
    const data = await res.json();
    allItems = data.items;
    return allItems;
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
                const spriteCSS = item.sprite ? buildSpriteCSSFromSprite(item.sprite) : '';
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

function populateSpriteSelect(selectedSpriteId) {
    const select = document.getElementById('adm-equip-sprite-select');
    select.innerHTML = '<option value="">-- Selectionner un sprite --</option>';

    // Group sprites by sheet type
    const grouped = {};
    allSprites.forEach(spr => {
        const type = spr.spriteSheet?.type || 'unknown';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(spr);
    });

    for (const type of Object.keys(grouped).sort()) {
        const optGroup = document.createElement('optgroup');
        optGroup.label = type;
        grouped[type].forEach(spr => {
            const opt = document.createElement('option');
            opt.value = spr.id;
            opt.textContent = `${spr.name} (${spr.spriteX},${spr.spriteY} ${spr.spriteW}x${spr.spriteH})`;
            if (selectedSpriteId && spr.id === selectedSpriteId) {
                opt.selected = true;
            }
            optGroup.appendChild(opt);
        });
        select.appendChild(optGroup);
    }
}

function updateEquipSpritePreview() {
    const select = document.getElementById('adm-equip-sprite-select');
    const preview = document.getElementById('adm-equip-sprite-preview');
    if (!select || !preview) return;

    const spriteId = parseInt(select.value);
    if (!spriteId) {
        preview.style.backgroundImage = '';
        return;
    }

    const spr = allSprites.find(s => s.id === spriteId);
    if (!spr) {
        preview.style.backgroundImage = '';
        return;
    }

    const css = buildSpriteCSSFromSprite(spr);
    preview.setAttribute('style', css);
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
        populateSpriteSelect(item.spriteId);
    } else {
        title.textContent = 'Nouvel Equipement';
        document.getElementById('adm-equip-id').value = '';
        document.getElementById('adm-equip-form').reset();
        populateSpriteSelect(null);
    }

    modal.classList.remove('hidden');
    updateEquipSpritePreview();
}

function closeEditModal() {
    document.getElementById('adm-equip-modal').classList.add('hidden');
}

async function saveItem(e) {
    e.preventDefault();
    const id = document.getElementById('adm-equip-id').value;
    const spriteId = parseInt(document.getElementById('adm-equip-sprite-select').value);

    if (!spriteId) {
        showToast('Veuillez selectionner un sprite', 'error');
        return;
    }

    const data = {
        type: document.getElementById('adm-equip-type').value,
        tier: parseInt(document.getElementById('adm-equip-tier').value),
        skin: document.getElementById('adm-equip-skin').value.trim(),
        name: document.getElementById('adm-equip-name').value.trim(),
        spriteId,
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

async function loadEquipmentSection() {
    const container = document.getElementById('adm-equip-list');
    container.innerHTML = '<p class="adm-loading">Chargement des equipements...</p>';
    try {
        await Promise.all([fetchEquipmentItems(), fetchAllSprites(), fetchSpriteSheets()]);
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

    // Sprite select preview
    document.getElementById('adm-equip-sprite-select')?.addEventListener('change', updateEquipSpritePreview);
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
        document.querySelectorAll('[data-section="sprites"]').forEach(el => {
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
    initSpritesSection();
    initEquipmentSection();
    initBroadcastSection();
    applyRoleVisibility();
}

window.addEventListener('DOMContentLoaded', init);
