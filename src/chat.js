/**
 * Chat UI — real-time chat with preview and full-page overlay.
 * Includes player profile viewing, PVP combat sharing, combat replay,
 * and moderation features (message deletion, role badges, system messages).
 */

import { t } from './i18n/i18n.js';
import { gameEvents, EVENTS } from './events.js';
import { getSocket } from './socket-client.js';
import { getCurrentUser } from './auth.js';
import { getProfileEmoji } from './state.js';
import { PROFILE_PICTURES, EQUIPMENT_ICONS, TIERS } from './config.js';
import { isStaff, deleteChatMessage, warnUser, muteUser, banUser, kickUser } from './admin.js';

let chatOpen = false;
let recentMessages = []; // Keep last messages for preview

export function initChat() {
    const chatPreview = document.getElementById('chat-preview');
    const chatPanel = document.getElementById('chat-panel');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    // Click preview to open full-page chat
    chatPreview?.addEventListener('click', () => {
        chatOpen = true;
        chatPanel?.classList.add('open');
        chatPreview?.classList.remove('has-unread');
        chatInput?.focus();
        scrollToBottom();
    });

    // Close full-page chat
    chatClose?.addEventListener('click', () => {
        chatOpen = false;
        chatPanel?.classList.remove('open');
    });

    // Send message
    chatSend?.addEventListener('click', sendMessage);

    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Close player profile modal
    document.getElementById('chat-profile-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'chat-profile-modal') {
            e.target.classList.remove('active');
        }
    });

    // Close combat replay modal
    document.getElementById('chat-replay-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'chat-replay-modal') {
            e.target.classList.remove('active');
        }
    });

    // Adapt chat height when virtual keyboard opens/closes
    if (window.visualViewport) {
        const onViewportResize = () => {
            if (!chatPanel) return;
            const vvh = window.visualViewport.height;
            const offset = window.visualViewport.offsetTop;
            chatPanel.style.height = `${vvh}px`;
            chatPanel.style.top = `${offset}px`;
        };
        window.visualViewport.addEventListener('resize', onViewportResize);
        window.visualViewport.addEventListener('scroll', onViewportResize);
    }

    setupSocketListeners();

    gameEvents.on(EVENTS.LOCALE_CHANGED, updatePreview);
}

function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('chat:history', (messages) => {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = '';
        recentMessages = [];
        messages.forEach(msg => {
            appendMessage(msg);
            recentMessages.push(msg);
        });
        // Keep only last messages
        if (recentMessages.length > 50) {
            recentMessages = recentMessages.slice(-50);
        }
        updatePreview();
        scrollToBottom();
    });

    socket.on('chat:message', (msg) => {
        appendMessage(msg);
        recentMessages.push(msg);
        if (recentMessages.length > 50) {
            recentMessages = recentMessages.slice(-50);
        }
        updatePreview();
        scrollToBottom();

        // Show unread indicator if chat is closed
        if (!chatOpen) {
            const chatPreview = document.getElementById('chat-preview');
            chatPreview?.classList.add('has-unread');
        }
    });

    // Message deleted by moderator
    socket.on('chat:message-deleted', (data) => {
        const { messageId } = data;
        const container = document.getElementById('chat-messages');
        if (!container) return;
        const msgEl = container.querySelector(`[data-msg-id="${messageId}"]`);
        if (msgEl) {
            msgEl.remove();
        }
        recentMessages = recentMessages.filter(m => m.id !== messageId);
        updatePreview();
    });

    // System broadcast message
    socket.on('chat:system', (data) => {
        appendSystemMessage(data);
        scrollToBottom();

        if (!chatOpen) {
            const chatPreview = document.getElementById('chat-preview');
            chatPreview?.classList.add('has-unread');
        }
    });

    // Chat error (e.g. muted)
    socket.on('chat:error', (data) => {
        if (data?.message) {
            appendLocalNotice(data.message);
            scrollToBottom();
        }
    });

    // Admin kicked
    socket.on('admin:kicked', (data) => {
        appendLocalNotice(data?.message || 'You have been disconnected by a moderator.');
    });

    // Combat shared in chat
    socket.on('chat:combat', (data) => {
        appendCombatMessage(data);
        scrollToBottom();

        if (!chatOpen) {
            const chatPreview = document.getElementById('chat-preview');
            chatPreview?.classList.add('has-unread');
        }
    });

    // Player profile response
    socket.on('chat:player-profile', (data) => {
        if (data.error) return;
        showPlayerProfileModal(data);
    });

    // Combat log response for replay
    socket.on('chat:combat-log', (data) => {
        if (data.error) return;
        showCombatReplay(data.log);
    });
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const socket = getSocket();
    if (!input || !socket) return;

    const content = input.value.trim();
    if (!content) return;

    socket.emit('chat:message', { content, channel: 'general' });
    input.value = '';
    input.focus();
}

function getAvatarEmoji(msg) {
    const user = getCurrentUser();
    if (user && msg.senderId === user.id) {
        return getProfileEmoji();
    }
    if (msg.senderAvatar) {
        const pic = PROFILE_PICTURES.find(p => p.id === msg.senderAvatar);
        if (pic) return pic.emoji;
    }
    return '\uD83E\uDDD9';
}

function getAvatarEmojiById(avatarId) {
    if (avatarId) {
        const pic = PROFILE_PICTURES.find(p => p.id === avatarId);
        if (pic) return pic.emoji;
    }
    return '\uD83E\uDDD9';
}

function getRoleBadge(role) {
    if (role === 'admin') return '<span class="chat-role-badge chat-role-admin">ADMIN</span>';
    if (role === 'moderator') return '<span class="chat-role-badge chat-role-mod">MOD</span>';
    return '';
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const user = getCurrentUser();
    const isOwn = user && msg.senderId === user.id;
    const staff = isStaff();

    const el = document.createElement('div');
    el.className = `chat-msg ${isOwn ? 'chat-msg-own' : ''}`;
    el.dataset.msgId = msg.id;

    const avatar = getAvatarEmoji(msg);
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const roleBadge = getRoleBadge(msg.senderRole);

    let deleteBtn = '';
    if (staff && !isOwn) {
        deleteBtn = `<button class="chat-delete-btn" data-delete-id="${msg.id}" title="${t('chat.delete')}">&#10005;</button>`;
    }

    el.innerHTML = `<span class="chat-avatar chat-clickable">${avatar}</span>` +
        `<div class="chat-msg-body">` +
        `<span class="chat-time">${time}</span>` +
        `<span class="chat-sender chat-clickable">${escapeHtml(msg.sender)}</span>${roleBadge}` +
        `<div class="chat-text">${escapeHtml(msg.content)}</div>` +
        `</div>` +
        deleteBtn;

    // Click on avatar or sender name to view profile (including own)
    if (msg.senderId) {
        const avatarEl = el.querySelector('.chat-avatar');
        const senderEl = el.querySelector('.chat-sender');
        const openProfile = (e) => {
            e.stopPropagation();
            const socket = getSocket();
            if (socket) {
                socket.emit('chat:player-profile', { userId: msg.senderId });
            }
        };
        avatarEl?.addEventListener('click', openProfile);
        senderEl?.addEventListener('click', openProfile);
    }

    // Wire delete button
    const delBtn = el.querySelector('.chat-delete-btn');
    if (delBtn) {
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgId = parseInt(delBtn.dataset.deleteId);
            if (msgId && confirm(t('chat.deleteConfirm'))) {
                deleteChatMessage(msgId);
            }
        });
    }

    container.appendChild(el);
}

function appendSystemMessage(data) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-system';
    el.innerHTML =
        `<div class="chat-system-content">` +
            `<span class="chat-system-icon">📢</span>` +
            `<span class="chat-system-text">${escapeHtml(data.content)}</span>` +
        `</div>`;
    container.appendChild(el);
}

function appendLocalNotice(text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-notice';
    el.innerHTML = `<div class="chat-notice-text">${escapeHtml(text)}</div>`;
    container.appendChild(el);
}

// --- Combat message in chat ---

function appendCombatMessage(data) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const p1Emoji = getAvatarEmojiById(data.player1.avatar);
    const p2Emoji = getAvatarEmojiById(data.player2.avatar);

    const isP1Winner = data.winnerId === data.player1.userId;
    const isP2Winner = data.winnerId === data.player2.userId;
    const isDraw = !data.winnerId;

    const el = document.createElement('div');
    el.className = 'chat-combat-msg';
    el.innerHTML =
        `<div class="chat-combat-title">\u2694\uFE0F ${t('chat.pvpCombat')}</div>` +
        `<div class="chat-combat-players">` +
            `<div class="chat-combat-player ${isP1Winner ? 'chat-combat-winner' : ''} ${!isP1Winner && !isDraw ? 'chat-combat-loser' : ''}">` +
                `<span class="chat-combat-avatar">${p1Emoji}</span>` +
                `<span class="chat-combat-name">${escapeHtml(data.player1.username)}</span>` +
                `${isP1Winner ? '<span class="chat-combat-crown">\uD83D\uDC51</span>' : ''}` +
            `</div>` +
            `<div class="chat-combat-vs">VS</div>` +
            `<div class="chat-combat-player ${isP2Winner ? 'chat-combat-winner' : ''} ${!isP2Winner && !isDraw ? 'chat-combat-loser' : ''}">` +
                `<span class="chat-combat-avatar">${p2Emoji}</span>` +
                `<span class="chat-combat-name">${escapeHtml(data.player2.username)}</span>` +
                `${isP2Winner ? '<span class="chat-combat-crown">\uD83D\uDC51</span>' : ''}` +
            `</div>` +
        `</div>` +
        `${isDraw ? '<div class="chat-combat-draw">' + t('chat.draw') + '</div>' : ''}` +
        `<div class="chat-combat-replay-hint">\u25B6 ${t('chat.tapToReplay')}</div>`;

    el.addEventListener('click', () => {
        const socket = getSocket();
        if (socket) {
            socket.emit('chat:get-combat', { combatId: data.combatId });
        }
    });

    container.appendChild(el);
}

// --- Player profile modal ---

function showPlayerProfileModal(data) {
    const modal = document.getElementById('chat-profile-modal');
    const content = document.getElementById('chat-profile-content');
    if (!modal || !content) return;

    const emoji = getAvatarEmojiById(data.profilePicture);
    const equipment = data.equipment || {};
    const roleBadge = getRoleBadge(data.role);

    let equipmentHtml = '';
    const slots = ['hat', 'armor', 'belt', 'boots', 'gloves', 'necklace', 'ring', 'weapon'];
    slots.forEach(slot => {
        const item = equipment[slot];
        const icon = EQUIPMENT_ICONS[slot] || '';
        if (item) {
            const tierDef = TIERS[(item.tier || 1) - 1];
            equipmentHtml += `<div class="chat-profile-equip-item">` +
                `<span class="chat-profile-equip-icon">${icon}</span>` +
                `<span class="chat-profile-equip-name" style="color:${tierDef.color}">${tierDef.name}</span>` +
                `<span class="chat-profile-equip-level">Lv.${item.level}</span>` +
                `</div>`;
        } else {
            equipmentHtml += `<div class="chat-profile-equip-item chat-profile-equip-empty">` +
                `<span class="chat-profile-equip-icon">${icon}</span>` +
                `<span class="chat-profile-equip-name">${t('home.empty')}</span>` +
                `</div>`;
        }
    });

    const user = getCurrentUser();
    const isOwnProfile = user && data.userId === user.id;
    const staff = isStaff();

    // Moderation section for staff (not on own profile)
    let moderationHtml = '';
    if (data.moderation && !isOwnProfile) {
        const mod = data.moderation;
        moderationHtml = `<div class="chat-profile-moderation">` +
            `<div class="chat-profile-section-title">\uD83D\uDEE1\uFE0F Moderation</div>` +
            `<div class="chat-profile-mod-stats">` +
                `<span>Lv.${mod.playerLevel}</span>` +
                `<span>Gold: ${(mod.gold || 0).toLocaleString()}</span>` +
                `<span>Essence: ${(mod.essence || 0).toLocaleString()}</span>` +
            `</div>` +
            `<div class="chat-profile-mod-warnings">` +
                `<span class="chat-profile-mod-label">Avertissements: ${mod.warnings?.length || 0}</span>` +
                (mod.warnings?.length > 0 ? mod.warnings.slice(0, 3).map(w =>
                    `<div class="chat-profile-mod-warn-item">${escapeHtml(w.reason)} <small>(${new Date(w.createdAt).toLocaleDateString('fr-FR')})</small></div>`
                ).join('') : '') +
            `</div>` +
            (mod.activeBans?.length > 0 ? `<div class="chat-profile-mod-status chat-profile-mod-banned">\uD83D\uDEAB Banni</div>` : '') +
            (mod.activeMutes?.length > 0 ? `<div class="chat-profile-mod-status chat-profile-mod-muted">\uD83D\uDD07 Mute</div>` : '') +
            `<div class="chat-profile-mod-actions">` +
                `<button class="chat-mod-btn chat-mod-btn-warn" data-action="warn">\u26A0\uFE0F Warn</button>` +
                `<button class="chat-mod-btn chat-mod-btn-mute" data-action="mute">\uD83D\uDD07 Mute</button>` +
                `<button class="chat-mod-btn chat-mod-btn-ban" data-action="ban">\uD83D\uDEAB Ban</button>` +
                `<button class="chat-mod-btn chat-mod-btn-kick" data-action="kick">\uD83D\uDC62 Kick</button>` +
            `</div>` +
        `</div>`;
    }

    // Only show PVP button for other players
    const pvpBtnHtml = isOwnProfile
        ? ''
        : `<button class="chat-profile-fight-btn" id="chat-profile-fight">\u2694\uFE0F ${t('chat.challengePvp')}</button>`;

    content.innerHTML =
        `<button class="modal-close-btn" id="chat-profile-close">\u2715</button>` +
        `<div class="chat-profile-header">` +
            `<div class="chat-profile-avatar">${emoji}</div>` +
            `<div class="chat-profile-info">` +
                `<div class="chat-profile-name">${escapeHtml(data.username)} ${roleBadge}</div>` +
                `<div class="chat-profile-rank">${data.rank.icon} ${data.rank.name}</div>` +
            `</div>` +
        `</div>` +
        `<div class="chat-profile-stats">` +
            `<div class="chat-profile-stat">\uD83D\uDD25 <span>${t('chat.power')}</span><strong>${formatNum(data.power)}</strong></div>` +
            `<div class="chat-profile-stat">\u2764\uFE0F <span>${t('chat.hp')}</span><strong>${formatNum(data.maxHP)}</strong></div>` +
            `<div class="chat-profile-stat">\u2694\uFE0F <span>${t('chat.damage')}</span><strong>${formatNum(data.damage)}</strong></div>` +
            `<div class="chat-profile-stat">\u2692\uFE0F <span>${t('chat.forgeLabel')}</span><strong>Lv.${data.forgeLevel}</strong></div>` +
        `</div>` +
        `<div class="chat-profile-pvp-stats">` +
            `<span>\uD83C\uDFC6 ${data.pvpRating} ELO</span>` +
            `<span>\u2705 ${data.pvpWins}W</span>` +
            `<span>\u274C ${data.pvpLosses}L</span>` +
        `</div>` +
        `<div class="chat-profile-section-title">${t('chat.equipment')}</div>` +
        `<div class="chat-profile-equipment">${equipmentHtml}</div>` +
        moderationHtml +
        pvpBtnHtml;

    modal.classList.add('active');

    document.getElementById('chat-profile-close')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // PVP fight button (only for other players)
    document.getElementById('chat-profile-fight')?.addEventListener('click', () => {
        modal.classList.remove('active');
        const socket = getSocket();
        if (socket) {
            socket.emit('pvp:queue');
        }
    });

    // Moderation action buttons
    if (data.moderation && !isOwnProfile) {
        wireModActions(content, data.userId, modal);
    }
}

function wireModActions(container, targetUserId, modal) {
    container.querySelectorAll('.chat-mod-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            try {
                if (action === 'warn') {
                    const reason = prompt('Raison de l\'avertissement:');
                    if (!reason) return;
                    await warnUser(targetUserId, reason);
                    alert('Avertissement envoy\u00e9.');
                } else if (action === 'mute') {
                    const reason = prompt('Raison du mute:');
                    if (!reason) return;
                    const duration = prompt('Dur\u00e9e en minutes (d\u00e9faut: 30):', '30');
                    await muteUser(targetUserId, reason, parseInt(duration) || 30);
                    alert('Joueur mute.');
                } else if (action === 'ban') {
                    const reason = prompt('Raison du ban:');
                    if (!reason) return;
                    const duration = prompt('Dur\u00e9e en heures (vide = permanent):');
                    await banUser(targetUserId, reason, duration ? parseInt(duration) * 60 : undefined);
                    alert('Joueur banni.');
                } else if (action === 'kick') {
                    if (!confirm('Kick ce joueur?')) return;
                    await kickUser(targetUserId);
                    alert('Joueur kick.');
                }
                modal.classList.remove('active');
            } catch (err) {
                alert(err.message || 'Action \u00e9chou\u00e9e.');
            }
        });
    });
}

// --- Combat replay modal ---

function showCombatReplay(log) {
    const modal = document.getElementById('chat-replay-modal');
    const content = document.getElementById('chat-replay-content');
    if (!modal || !content) return;

    const p1Emoji = getAvatarEmojiById(log.player1.avatar);
    const p2Emoji = getAvatarEmojiById(log.player2.avatar);
    const isP1Winner = log.winnerId === log.player1.userId;
    const isP2Winner = log.winnerId === log.player2.userId;

    let turnsHtml = '';
    (log.turns || []).forEach(tn => {
        turnsHtml += `<div class="replay-turn">` +
            `<div class="replay-turn-num">${t('chat.turn')} ${tn.turn}</div>` +
            `<div class="replay-turn-row">` +
                `<span class="replay-action">${actionIcon(tn.player1.action)} ${tn.player1.damage > 0 ? tn.player1.damage + ' ' + t('chat.dmg') : ''}${tn.player1.isCrit ? ' ' + t('chat.crit') : ''}</span>` +
                `<span class="replay-hp">${Math.floor(tn.player1.currentHP)}/${tn.player1.maxHP}</span>` +
            `</div>` +
            `<div class="replay-turn-row">` +
                `<span class="replay-action">${actionIcon(tn.player2.action)} ${tn.player2.damage > 0 ? tn.player2.damage + ' ' + t('chat.dmg') : ''}${tn.player2.isCrit ? ' ' + t('chat.crit') : ''}</span>` +
                `<span class="replay-hp">${Math.floor(tn.player2.currentHP)}/${tn.player2.maxHP}</span>` +
            `</div>` +
            `</div>`;
    });

    content.innerHTML =
        `<button class="modal-close-btn" id="chat-replay-close">\u2715</button>` +
        `<div class="chat-combat-title">\u2694\uFE0F ${t('chat.combatReplay')}</div>` +
        `<div class="chat-combat-players" style="margin-bottom:12px">` +
            `<div class="chat-combat-player ${isP1Winner ? 'chat-combat-winner' : ''}">` +
                `<span class="chat-combat-avatar">${p1Emoji}</span>` +
                `<span class="chat-combat-name">${escapeHtml(log.player1.username)}</span>` +
            `</div>` +
            `<div class="chat-combat-vs">VS</div>` +
            `<div class="chat-combat-player ${isP2Winner ? 'chat-combat-winner' : ''}">` +
                `<span class="chat-combat-avatar">${p2Emoji}</span>` +
                `<span class="chat-combat-name">${escapeHtml(log.player2.username)}</span>` +
            `</div>` +
        `</div>` +
        `<div class="replay-turns">${turnsHtml}</div>`;

    modal.classList.add('active');

    document.getElementById('chat-replay-close')?.addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

function actionIcon(action) {
    switch (action) {
        case 'attack': return '\u2694\uFE0F';
        case 'defend': return '\uD83D\uDEE1\uFE0F';
        case 'special': return '\uD83D\uDCA5';
        default: return '';
    }
}

// --- Share combat from PVP result screen ---

export function shareCombatInChat(combatId) {
    const socket = getSocket();
    if (!socket || !combatId) return;
    socket.emit('chat:share-combat', { combatId, channel: 'general' });
}

// --- Utility ---

function updatePreview() {
    const previewContainer = document.getElementById('chat-preview-messages');
    if (!previewContainer) return;

    previewContainer.textContent = '';

    if (recentMessages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'chat-preview-empty';
        empty.textContent = t('chat.noMessages');
        previewContainer.appendChild(empty);
        return;
    }

    // Show last 2 messages
    const last2 = recentMessages.slice(-2);
    last2.forEach(msg => {
        const line = document.createElement('div');
        line.className = 'chat-preview-line';
        line.innerHTML = `<span class="chat-preview-sender">${escapeHtml(msg.sender)}:</span> ${escapeHtml(msg.content)}`;
        previewContainer.appendChild(line);
    });
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNum(n) {
    return (n || 0).toLocaleString('en-US');
}

export function refreshChatSocket() {
    setupSocketListeners();
}
