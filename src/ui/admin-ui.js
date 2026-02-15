/**
 * Admin UI — panel, search, user management, moderation.
 */

import {
    isStaff, isAdmin, isModerator, getUserRole,
    searchUsers, getUserProfile,
    warnUser, muteUser, unmuteUser, banUser, unbanUser, kickUser,
    addGoldToUser, addEssenceToUser, addDiamondsToUser, setUserLevel, setUserRole, resetUserState,
    getServerStats, getAuditLog, broadcastMessage,
} from '../admin.js';
import { getCurrentUser } from '../auth.js';
import { addGold, addEssence, addDiamonds, saveGame, resetGame } from '../state.js';
import { showToast } from './helpers.js';
import { stopCombat, startCombat } from '../combat.js';
import { updateWaveDisplay } from './combat-ui.js';

let currentSection = 'players';
let selectedUserId = null;

export function initAdminUI() {
    const user = getCurrentUser();
    const fab = document.getElementById('admin-fab');
    if (!fab) return;

    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
        fab.classList.add('hidden');
        return;
    }

    fab.classList.remove('hidden');
    fab.textContent = user.role === 'admin' ? 'ADM' : 'MOD';

    // Drag & drop support for admin FAB
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let fabStartX = 0, fabStartY = 0;
    let hasMoved = false;

    function onPointerDown(e) {
        isDragging = true;
        hasMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = fab.getBoundingClientRect();
        fabStartX = rect.left;
        fabStartY = rect.top;
        fab.setPointerCapture(e.pointerId);
        fab.style.transition = 'none';
    }

    function onPointerMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
        if (!hasMoved) return;
        const newX = Math.max(0, Math.min(window.innerWidth - 40, fabStartX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - 40, fabStartY + dy));
        fab.style.left = newX + 'px';
        fab.style.top = newY + 'px';
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
    }

    function onPointerUp(e) {
        isDragging = false;
        fab.style.transition = '';
        if (hasMoved) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    fab.addEventListener('pointerdown', onPointerDown);
    fab.addEventListener('pointermove', onPointerMove);
    fab.addEventListener('pointerup', onPointerUp);

    fab.addEventListener('click', (e) => {
        if (hasMoved) { hasMoved = false; return; }
        openAdminPanel();
    });
}

function openAdminPanel() {
    const modal = document.getElementById('admin-modal');
    if (!modal) return;
    modal.classList.add('active');
    renderAdminPanel();
}

function renderAdminPanel() {
    const content = document.getElementById('admin-panel-content');
    if (!content) return;

    const role = getUserRole();
    const isAdm = role === 'admin';

    // Build nav tabs
    const sections = [
        { id: 'players', label: 'Joueurs', icon: '👥' },
        { id: 'self', label: 'Mon Compte', icon: '🛠️' },
    ];
    if (isAdm) {
        sections.push({ id: 'stats', label: 'Stats', icon: '📊' });
    }
    sections.push({ id: 'logs', label: 'Logs', icon: '📋' });
    if (isAdm) {
        sections.push({ id: 'broadcast', label: 'Annonce', icon: '📢' });
    }

    let navHtml = '<div class="admin-nav">';
    sections.forEach(s => {
        navHtml += `<button class="admin-nav-btn ${currentSection === s.id ? 'active' : ''}" data-section="${s.id}">${s.icon} ${s.label}</button>`;
    });
    navHtml += '</div>';

    content.innerHTML = navHtml + '<div class="admin-section-content" id="admin-section-content"></div>';

    // Wire nav
    content.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSection = btn.dataset.section;
            renderAdminPanel();
        });
    });

    // Render current section
    const sectionEl = document.getElementById('admin-section-content');
    switch (currentSection) {
        case 'players': renderPlayersSection(sectionEl); break;
        case 'self': renderSelfSection(sectionEl); break;
        case 'stats': renderStatsSection(sectionEl); break;
        case 'logs': renderLogsSection(sectionEl); break;
        case 'broadcast': renderBroadcastSection(sectionEl); break;
    }
}

// ─── Players Section ──────────────────────────────────────────────

function renderPlayersSection(container) {
    container.innerHTML =
        `<div class="admin-search-bar">` +
            `<input type="text" id="admin-user-search" placeholder="Rechercher un joueur..." maxlength="30" autocomplete="off">` +
            `<button class="btn admin-btn" id="admin-search-btn">Rechercher</button>` +
        `</div>` +
        `<div id="admin-search-results"></div>` +
        `<div id="admin-user-detail"></div>`;

    const searchInput = document.getElementById('admin-user-search');
    const searchBtn = document.getElementById('admin-search-btn');

    const doSearch = async () => {
        const q = searchInput.value.trim();
        if (!q) return;
        const resultsEl = document.getElementById('admin-search-results');
        resultsEl.innerHTML = '<p class="admin-loading">Recherche...</p>';
        try {
            const data = await searchUsers(q);
            renderSearchResults(data.users);
        } catch (err) {
            resultsEl.innerHTML = `<p class="admin-error">${escapeHtml(err.message)}</p>`;
        }
    };

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });
}

function renderSearchResults(users) {
    const container = document.getElementById('admin-search-results');
    if (!users.length) {
        container.innerHTML = '<p class="admin-empty">Aucun joueur trouve.</p>';
        return;
    }

    let html = '<div class="admin-user-list">';
    users.forEach(u => {
        const roleBadge = u.role !== 'user' ? `<span class="admin-role-badge admin-role-${u.role}">${u.role}</span>` : '';
        html += `<div class="admin-user-item" data-uid="${u.id}">` +
            `<span class="admin-user-name">${escapeHtml(u.username)}</span>` +
            `${roleBadge}` +
            `<span class="admin-user-meta">ID: ${u.id}</span>` +
        `</div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.admin-user-item').forEach(el => {
        el.addEventListener('click', () => {
            selectedUserId = parseInt(el.dataset.uid);
            loadUserDetail(selectedUserId);
        });
    });
}

async function loadUserDetail(userId) {
    const detail = document.getElementById('admin-user-detail');
    if (!detail) return;
    detail.innerHTML = '<p class="admin-loading">Chargement...</p>';

    try {
        const data = await getUserProfile(userId);
        renderUserDetail(detail, data);
    } catch (err) {
        detail.innerHTML = `<p class="admin-error">${escapeHtml(err.message)}</p>`;
    }
}

function renderUserDetail(container, data) {
    const { user, warnings, bans, mutes } = data;
    const isAdm = isAdmin();
    const gs = user.gameState || {};
    const player = gs.player || { level: 1 };
    const level = typeof player === 'object' ? player.level : 1;

    let html = `<div class="admin-user-detail-card">`;
    html += `<h3>${escapeHtml(user.username)} <span class="admin-role-badge admin-role-${user.role}">${user.role}</span></h3>`;
    html += `<div class="admin-user-stats">`;
    html += `<span>Niveau: ${level}</span>`;
    html += `<span>Gold: ${(gs.gold || 0).toLocaleString()}</span>`;
    html += `<span>Essence: ${(gs.essence || 0).toLocaleString()}</span>`;
    html += `<span>💎 ${(gs.diamonds || 0).toLocaleString()}</span>`;
    html += `<span>Forge: Lv.${gs.forgeLevel || 1}</span>`;
    html += `<span>PvP: ${user.pvpRating} ELO (${user.pvpWins}W/${user.pvpLosses}L)</span>`;
    html += `</div>`;

    // Moderation actions (admin + moderator)
    html += `<div class="admin-actions-row">`;
    html += `<button class="btn admin-btn admin-btn-warn" data-action="warn">Avertir</button>`;
    html += `<button class="btn admin-btn admin-btn-mute" data-action="mute">Mute</button>`;
    html += `<button class="btn admin-btn admin-btn-ban" data-action="ban">Ban Temp</button>`;
    html += `<button class="btn admin-btn admin-btn-kick" data-action="kick">Kick</button>`;
    if (isAdm) {
        html += `<button class="btn admin-btn admin-btn-permban" data-action="permban">Ban Perm</button>`;
    }
    html += `</div>`;

    // Admin-only: resource management
    if (isAdm) {
        html += `<div class="admin-resource-row">`;
        html += `<h4>Ressources (Admin)</h4>`;
        html += `<div class="admin-resource-actions">`;
        html += `<button class="btn admin-btn admin-btn-gold" data-action="gold-10k">+10K Gold</button>`;
        html += `<button class="btn admin-btn admin-btn-gold" data-action="gold-100k">+100K Gold</button>`;
        html += `<button class="btn admin-btn admin-btn-essence" data-action="essence-1k">+1K Essence</button>`;
        html += `<button class="btn admin-btn admin-btn-essence" data-action="essence-10k">+10K Essence</button>`;
        html += `<button class="btn admin-btn admin-btn-diamond" data-action="diamond-100">+100 💎</button>`;
        html += `<button class="btn admin-btn admin-btn-diamond" data-action="diamond-1k">+1K 💎</button>`;
        html += `</div>`;
        html += `<div class="admin-resource-actions">`;
        html += `<label>Role: <select id="admin-role-select">`;
        ['user', 'moderator', 'admin'].forEach(r => {
            html += `<option value="${r}" ${user.role === r ? 'selected' : ''}>${r}</option>`;
        });
        html += `</select></label>`;
        html += `<button class="btn admin-btn" data-action="set-role">Changer Role</button>`;
        html += `<button class="btn admin-btn admin-btn-reset" data-action="reset">Reset Etat</button>`;
        html += `</div>`;
        html += `</div>`;
    }

    // Unban/Unmute buttons if applicable
    const hasActiveBan = bans?.some(b => b.active);
    const hasActiveMute = mutes?.some(m => m.active);
    if (hasActiveBan || hasActiveMute) {
        html += `<div class="admin-actions-row">`;
        if (hasActiveBan) html += `<button class="btn admin-btn" data-action="unban">Unban</button>`;
        if (hasActiveMute) html += `<button class="btn admin-btn" data-action="unmute">Unmute</button>`;
        html += `</div>`;
    }

    // Warnings history
    html += `<div class="admin-history">`;
    html += `<h4>Avertissements (${warnings?.length || 0})</h4>`;
    if (warnings?.length > 0) {
        html += `<div class="admin-history-list">`;
        warnings.forEach(w => {
            const date = new Date(w.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            html += `<div class="admin-history-item admin-history-warn">`;
            html += `<span class="admin-history-date">${date}</span>`;
            html += `<span class="admin-history-by">par ${escapeHtml(w.issuer?.username || '?')}</span>`;
            html += `<span class="admin-history-reason">${escapeHtml(w.reason)}</span>`;
            html += `</div>`;
        });
        html += `</div>`;
    } else {
        html += `<p class="admin-empty">Aucun avertissement</p>`;
    }

    // Bans history
    html += `<h4>Bans (${bans?.length || 0})</h4>`;
    if (bans?.length > 0) {
        html += `<div class="admin-history-list">`;
        bans.forEach(b => {
            const date = new Date(b.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const status = b.active ? '<span class="admin-status-active">Actif</span>' : '<span class="admin-status-expired">Expire</span>';
            const expiry = b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Permanent';
            html += `<div class="admin-history-item admin-history-ban">`;
            html += `${status} ${date} — ${expiry}`;
            html += `<span class="admin-history-reason">${escapeHtml(b.reason)}</span>`;
            html += `</div>`;
        });
        html += `</div>`;
    } else {
        html += `<p class="admin-empty">Aucun ban</p>`;
    }

    // Mutes history
    html += `<h4>Mutes (${mutes?.length || 0})</h4>`;
    if (mutes?.length > 0) {
        html += `<div class="admin-history-list">`;
        mutes.forEach(m => {
            const date = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
            const status = m.active ? '<span class="admin-status-active">Actif</span>' : '<span class="admin-status-expired">Expire</span>';
            html += `<div class="admin-history-item admin-history-mute">`;
            html += `${status} ${date}`;
            html += `<span class="admin-history-reason">${escapeHtml(m.reason)}</span>`;
            html += `</div>`;
        });
        html += `</div>`;
    } else {
        html += `<p class="admin-empty">Aucun mute</p>`;
    }

    html += `</div>`; // admin-history
    html += `</div>`; // admin-user-detail-card

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
                showToast('Avertissement envoye', 'level');
                break;
            }
            case 'mute': {
                const reason = prompt('Raison du mute:');
                if (!reason) return;
                const duration = prompt('Duree (ex: 30m, 1h, 24h):', '1h');
                if (!duration) return;
                await muteUser(userId, reason, duration);
                showToast('Joueur mute', 'level');
                break;
            }
            case 'ban': {
                const reason = prompt('Raison du ban temporaire:');
                if (!reason) return;
                const duration = prompt('Duree (ex: 1h, 1d, 7d):', '1d');
                if (!duration) return;
                await banUser(userId, reason, duration);
                showToast('Joueur banni', 'level');
                kickUser(userId);
                break;
            }
            case 'permban': {
                const reason = prompt('Raison du ban permanent:');
                if (!reason) return;
                if (!confirm('Confirmer le ban permanent?')) return;
                await banUser(userId, reason, null);
                showToast('Joueur banni definitivement', 'level');
                kickUser(userId);
                break;
            }
            case 'kick': {
                kickUser(userId);
                showToast('Joueur kick', 'level');
                break;
            }
            case 'unban': {
                await unbanUser(userId);
                showToast('Joueur unbanned', 'level');
                break;
            }
            case 'unmute': {
                await unmuteUser(userId);
                showToast('Joueur unmuted', 'level');
                break;
            }
            case 'gold-10k': {
                await addGoldToUser(userId, 10000);
                showToast('+10K gold', 'sell');
                break;
            }
            case 'gold-100k': {
                await addGoldToUser(userId, 100000);
                showToast('+100K gold', 'sell');
                break;
            }
            case 'essence-1k': {
                await addEssenceToUser(userId, 1000);
                showToast('+1K essence', 'study');
                break;
            }
            case 'essence-10k': {
                await addEssenceToUser(userId, 10000);
                showToast('+10K essence', 'study');
                break;
            }
            case 'diamond-100': {
                await addDiamondsToUser(userId, 100);
                showToast('+100 💎', 'level');
                break;
            }
            case 'diamond-1k': {
                await addDiamondsToUser(userId, 1000);
                showToast('+1K 💎', 'level');
                break;
            }
            case 'set-role': {
                const select = document.getElementById('admin-role-select');
                if (!select) return;
                const role = select.value;
                if (!confirm(`Changer le role en "${role}"?`)) return;
                await setUserRole(userId, role);
                showToast(`Role change: ${role}`, 'level');
                break;
            }
            case 'reset': {
                if (!confirm('Reinitialiser l\'etat du joueur? Irreversible!')) return;
                await resetUserState(userId);
                showToast('Etat reinitialise', 'level');
                break;
            }
        }
        // Reload user detail
        loadUserDetail(userId);
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'level');
    }
}

// ─── Self Section (add gold/essence to own account, admin mode) ──

function renderSelfSection(container) {
    const isAdm = isAdmin();

    let html = `<div class="admin-self-section">`;
    html += `<h3>Actions sur mon compte</h3>`;

    if (isAdm) {
        html += `<div class="admin-actions-row">`;
        html += `<button class="btn admin-btn admin-btn-gold" id="admin-self-gold-10k">+10K Gold</button>`;
        html += `<button class="btn admin-btn admin-btn-gold" id="admin-self-gold-100k">+100K Gold</button>`;
        html += `<button class="btn admin-btn admin-btn-gold" id="admin-self-gold-1m">+1M Gold</button>`;
        html += `<button class="btn admin-btn admin-btn-gold" id="admin-self-gold-10m">+10M Gold</button>`;
        html += `</div>`;
        html += `<div class="admin-actions-row">`;
        html += `<button class="btn admin-btn admin-btn-essence" id="admin-self-essence-1k">+1K Essence</button>`;
        html += `<button class="btn admin-btn admin-btn-essence" id="admin-self-essence-10k">+10K Essence</button>`;
        html += `</div>`;
        html += `<div class="admin-actions-row">`;
        html += `<button class="btn admin-btn admin-btn-diamond" id="admin-self-diamond-100">+100 💎</button>`;
        html += `<button class="btn admin-btn admin-btn-diamond" id="admin-self-diamond-1k">+1K 💎</button>`;
        html += `<button class="btn admin-btn admin-btn-diamond" id="admin-self-diamond-10k">+10K 💎</button>`;
        html += `</div>`;
        html += `<div class="admin-actions-row">`;
        html += `<button class="btn admin-btn admin-btn-reset" id="admin-self-reset">Reset Ma Progression</button>`;
        html += `</div>`;

        // Admin mode toggle
        const adminModeActive = window.__adminMode || false;
        html += `<div class="admin-mode-section">`;
        html += `<h4>Mode Admin</h4>`;
        html += `<p class="admin-mode-desc">Desactive les temps d'attente et les couts (forge, recherche)</p>`;
        html += `<label class="admin-toggle">`;
        html += `<input type="checkbox" id="admin-mode-toggle" ${adminModeActive ? 'checked' : ''}>`;
        html += `<span class="admin-toggle-slider"></span>`;
        html += `<span class="admin-toggle-label">${adminModeActive ? 'Active' : 'Desactive'}</span>`;
        html += `</label>`;
        html += `</div>`;
    } else {
        html += `<p class="admin-info">En tant que moderateur, vous pouvez gerer les joueurs via l'onglet Joueurs.</p>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    if (isAdm) {
        document.getElementById('admin-self-gold-10k')?.addEventListener('click', () => { addGold(10_000); showToast('+10K gold', 'sell'); });
        document.getElementById('admin-self-gold-100k')?.addEventListener('click', () => { addGold(100_000); showToast('+100K gold', 'sell'); });
        document.getElementById('admin-self-gold-1m')?.addEventListener('click', () => { addGold(1_000_000); showToast('+1M gold', 'sell'); });
        document.getElementById('admin-self-gold-10m')?.addEventListener('click', () => { addGold(10_000_000); showToast('+10M gold', 'sell'); });
        document.getElementById('admin-self-essence-1k')?.addEventListener('click', () => { addEssence(1_000); showToast('+1K essence', 'study'); });
        document.getElementById('admin-self-essence-10k')?.addEventListener('click', () => { addEssence(10_000); showToast('+10K essence', 'study'); });
        document.getElementById('admin-self-diamond-100')?.addEventListener('click', () => { addDiamonds(100); showToast('+100 💎', 'level'); });
        document.getElementById('admin-self-diamond-1k')?.addEventListener('click', () => { addDiamonds(1_000); showToast('+1K 💎', 'level'); });
        document.getElementById('admin-self-diamond-10k')?.addEventListener('click', () => { addDiamonds(10_000); showToast('+10K 💎', 'level'); });
        document.getElementById('admin-self-reset')?.addEventListener('click', () => {
            if (!confirm('Reset all progression? This cannot be undone.')) return;
            stopCombat();
            resetGame();
            saveGame();
            updateWaveDisplay();
            startCombat();
            showToast('Progression reinitialise', 'level');
        });
        document.getElementById('admin-mode-toggle')?.addEventListener('change', (e) => {
            window.__adminMode = e.target.checked;
            const label = e.target.parentElement.querySelector('.admin-toggle-label');
            if (label) label.textContent = e.target.checked ? 'Active' : 'Desactive';
            showToast(e.target.checked ? 'Mode Admin active' : 'Mode Admin desactive', 'level');
        });
    }
}

// ─── Stats Section (admin only) ───────────────────────────────────

async function renderStatsSection(container) {
    container.innerHTML = '<p class="admin-loading">Chargement des statistiques...</p>';

    try {
        const stats = await getServerStats();
        container.innerHTML =
            `<div class="admin-stats-grid">` +
                `<div class="admin-stat-card">` +
                    `<div class="admin-stat-value">${stats.totalUsers}</div>` +
                    `<div class="admin-stat-label">Joueurs Total</div>` +
                `</div>` +
                `<div class="admin-stat-card">` +
                    `<div class="admin-stat-value">${stats.registeredUsers}</div>` +
                    `<div class="admin-stat-label">Inscrits</div>` +
                `</div>` +
                `<div class="admin-stat-card">` +
                    `<div class="admin-stat-value">${stats.totalGuests}</div>` +
                    `<div class="admin-stat-label">Invites</div>` +
                `</div>` +
                `<div class="admin-stat-card">` +
                    `<div class="admin-stat-value">${stats.totalGoldInCirculation.toLocaleString()}</div>` +
                    `<div class="admin-stat-label">Gold en Circulation</div>` +
                `</div>` +
                `<div class="admin-stat-card">` +
                    `<div class="admin-stat-value">${stats.totalEssenceInCirculation.toLocaleString()}</div>` +
                    `<div class="admin-stat-label">Essence en Circulation</div>` +
                `</div>` +
                `<div class="admin-stat-card">` +
                    `<div class="admin-stat-value">${(stats.totalDiamondsInCirculation || 0).toLocaleString()}</div>` +
                    `<div class="admin-stat-label">💎 en Circulation</div>` +
                `</div>` +
            `</div>`;
    } catch (err) {
        container.innerHTML = `<p class="admin-error">Erreur: ${escapeHtml(err.message)}</p>`;
    }
}

// ─── Logs Section ─────────────────────────────────────────────────

let logsPage = 1;

async function renderLogsSection(container) {
    container.innerHTML = '<p class="admin-loading">Chargement des logs...</p>';

    try {
        const data = await getAuditLog(logsPage);
        let html = `<div class="admin-logs">`;

        if (data.logs.length === 0) {
            html += `<p class="admin-empty">Aucun log</p>`;
        } else {
            html += `<table class="admin-logs-table">`;
            html += `<thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Details</th></tr></thead>`;
            html += `<tbody>`;
            data.logs.forEach(log => {
                const date = new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const details = log.details ? JSON.stringify(log.details).slice(0, 80) : '-';
                html += `<tr>`;
                html += `<td>${date}</td>`;
                html += `<td>${escapeHtml(log.actor?.username || '?')}</td>`;
                html += `<td><span class="admin-action-badge">${escapeHtml(log.action)}</span></td>`;
                html += `<td>${log.targetId || '-'}</td>`;
                html += `<td class="admin-log-details">${escapeHtml(details)}</td>`;
                html += `</tr>`;
            });
            html += `</tbody></table>`;

            // Pagination
            html += `<div class="admin-pagination">`;
            html += `<button class="btn admin-btn" id="admin-logs-prev" ${data.page <= 1 ? 'disabled' : ''}>Precedent</button>`;
            html += `<span>Page ${data.page} / ${data.pages}</span>`;
            html += `<button class="btn admin-btn" id="admin-logs-next" ${data.page >= data.pages ? 'disabled' : ''}>Suivant</button>`;
            html += `</div>`;
        }

        html += `</div>`;
        container.innerHTML = html;

        document.getElementById('admin-logs-prev')?.addEventListener('click', () => {
            if (logsPage > 1) { logsPage--; renderLogsSection(container); }
        });
        document.getElementById('admin-logs-next')?.addEventListener('click', () => {
            if (logsPage < data.pages) { logsPage++; renderLogsSection(container); }
        });
    } catch (err) {
        container.innerHTML = `<p class="admin-error">Erreur: ${escapeHtml(err.message)}</p>`;
    }
}

// ─── Broadcast Section (admin only) ───────────────────────────────

function renderBroadcastSection(container) {
    container.innerHTML =
        `<div class="admin-broadcast">` +
            `<h3>Annonce Systeme</h3>` +
            `<p class="admin-mode-desc">Envoyer un message a tous les joueurs connectes (affiche en dore dans le chat)</p>` +
            `<textarea id="admin-broadcast-text" rows="3" maxlength="500" placeholder="Message d'annonce..."></textarea>` +
            `<button class="btn admin-btn admin-btn-gold" id="admin-broadcast-send">Envoyer l'Annonce</button>` +
        `</div>`;

    document.getElementById('admin-broadcast-send')?.addEventListener('click', () => {
        const text = document.getElementById('admin-broadcast-text')?.value.trim();
        if (!text) return;
        broadcastMessage(text);
        showToast('Annonce envoyee', 'level');
        document.getElementById('admin-broadcast-text').value = '';
    });
}

// ─── Utility ──────────────────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
