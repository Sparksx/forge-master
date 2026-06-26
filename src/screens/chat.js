// Full-screen chat overlay, opened by tapping the home-screen chat preview.
// Three tabs: General (world), Clan (your clan), and Private (1:1 DMs + custom
// groups). Each tab shows the last 100 messages and has its own composer.
import { h, clear, fmt, openModal, closeModal, toast } from './components.js';
import { avatarEmoji } from '../game/config.js';
import { itemName, rarityName, rarityColor, itemIcon, slotLabel } from '../game/items.js';
import { EQUIPMENT_TYPES } from '../../shared/stats.js';
import { FRAMES } from '../../shared/cosmetics.js';
import { getCurrentUser } from '../auth.js';
import { getMyClanCached } from '../game/clan.js';
import { switchTab as navigateToScreen } from './app.js';
import { startFriendly } from './pvp.js';
import {
    getMessages, getConversations, requestHistory, requestConversations,
    sendChat, startDm, createGroup, fetchPlayerProfile,
} from '../game/chat.js';
import { gameEvents, EVENTS } from '../events.js';

// Only render frame classes we actually ship — guards against a tampered save
// injecting an arbitrary class name onto the avatar.
const VALID_FRAMES = new Set(FRAMES.map((f) => f.id));
const safeFrame = (id) => (VALID_FRAMES.has(id) ? id : 'none');

let panel = null;
let activeTab = 'general';
let activeConvId = null;
let handlers = null;

const TABS = [
    { id: 'general', label: 'General', icon: '🌍' },
    { id: 'clan', label: 'Clan', icon: '🛡️' },
    { id: 'private', label: 'Private', icon: '✉️' },
];

/** Open the chat overlay (optionally on a given tab). */
export function openChat(tab = 'general') {
    activeTab = tab;
    if (!panel) {
        panel = h('div', { className: 'chat-panel' });
        (document.querySelector('.app-root') || document.body).appendChild(panel);
    }
    panel.classList.add('open');
    bindEvents();
    requestConversations();
    render();
}

export function closeChat() {
    if (!panel) return;
    panel.classList.remove('open');
    unbindEvents();
}

// ── Live updates ──────────────────────────────────────────────────────────────
function bindEvents() {
    if (handlers) return;
    handlers = {
        updated: (info) => onUpdated(info),
        opened: (conv) => { activeTab = 'private'; activeConvId = conv?.id ?? activeConvId; render(); },
        error: (msg) => toast(msg, 'error'),
    };
    gameEvents.on(EVENTS.CHAT_UPDATED, handlers.updated);
    gameEvents.on(EVENTS.CHAT_CONVERSATION_OPENED, handlers.opened);
    gameEvents.on(EVENTS.CHAT_ERROR, handlers.error);
}

function unbindEvents() {
    if (!handlers) return;
    gameEvents.off(EVENTS.CHAT_UPDATED, handlers.updated);
    gameEvents.off(EVENTS.CHAT_CONVERSATION_OPENED, handlers.opened);
    gameEvents.off(EVENTS.CHAT_ERROR, handlers.error);
    handlers = null;
}

// Only re-render the message list (cheap) when an update is relevant to the view;
// re-render the whole panel when the conversation list changes.
function onUpdated(info = {}) {
    if (!panel?.classList.contains('open')) return;
    if (info.conversations) { render(); return; }
    syncMessages();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
    if (!panel) return;
    clear(panel);

    const head = h('div', { className: 'chat-head' },
        h('span', { className: 'chat-title', text: 'Chat' }),
        h('button', { className: 'chat-close', text: '✕', onclick: closeChat }),
    );

    const tabs = h('div', { className: 'chat-tabs' },
        ...TABS.map((t) => h('button', {
            className: `chat-tab${activeTab === t.id ? ' active' : ''}`,
            onclick: () => switchTab(t.id),
        }, h('span', { text: t.icon }), h('span', { text: t.label }))),
    );

    panel.appendChild(head);
    panel.appendChild(tabs);
    panel.appendChild(activeTab === 'private' ? buildPrivate() : buildChannel(activeTab));
}

// General / Clan: a message list + composer for a single fixed channel.
function buildChannel(tab) {
    if (tab === 'clan' && !getMyClanCached()) {
        return h('div', { className: 'chat-body' },
            h('div', { className: 'chat-empty' },
                h('p', { text: 'Join a clan to chat with your clanmates.' })));
    }
    requestHistory(tab === 'clan' ? 'clan' : 'general');
    const list = h('div', { className: 'chat-messages' });
    const body = h('div', { className: 'chat-body' }, list, buildComposer(tab));
    requestAnimationFrame(() => syncMessages());
    return body;
}

// Private: either the conversation list, or an open conversation.
function buildPrivate() {
    if (activeConvId == null) return buildConversationList();

    const conv = getConversations().find((c) => c.id === activeConvId);
    requestHistory(`conv:${activeConvId}`);

    const list = h('div', { className: 'chat-messages' });
    const sub = conv?.type === 'group'
        ? `${conv.members?.length || 0} members`
        : 'Direct message';
    const body = h('div', { className: 'chat-body' },
        h('div', { className: 'chat-convo-head' },
            h('button', { className: 'chat-back', text: '‹', onclick: () => { activeConvId = null; render(); } }),
            h('div', { className: 'chat-convo-meta' },
                h('span', { className: 'chat-convo-title', text: conv?.title || 'Conversation' }),
                h('span', { className: 'chat-convo-sub muted', text: sub }),
            ),
        ),
        list,
        buildComposer('private'),
    );
    requestAnimationFrame(() => syncMessages());
    return body;
}

function buildConversationList() {
    const convos = getConversations();
    const listEl = h('div', { className: 'chat-convo-list' });
    if (!convos.length) {
        listEl.appendChild(h('div', { className: 'chat-empty' },
            h('p', { text: 'No private chats yet. Start a direct message or create a group.' })));
    } else {
        convos.forEach((c) => listEl.appendChild(h('button', {
            className: 'chat-convo-item', onclick: () => { activeConvId = c.id; render(); },
        },
            h('span', { className: 'chat-convo-avatar', text: c.type === 'group' ? '👥' : '👤' }),
            h('div', { className: 'chat-convo-info' },
                h('span', { className: 'chat-convo-name', text: c.title }),
                h('span', { className: 'chat-convo-members muted', text: memberLine(c) }),
            ),
        )));
    }

    return h('div', { className: 'chat-body' },
        h('div', { className: 'chat-private-actions' },
            h('button', { className: 'btn btn-primary', text: '✉️ New message', onclick: promptNewDm }),
            h('button', { className: 'btn btn-ghost', text: '👥 New group', onclick: promptNewGroup }),
        ),
        listEl,
    );
}

function memberLine(conv) {
    const me = getCurrentUser();
    const names = (conv.members || []).filter((m) => m.id !== me?.id).map((m) => m.username).filter(Boolean);
    return names.length ? names.join(', ') : 'You';
}

function buildComposer(tab) {
    const input = h('input', {
        className: 'chat-input', attrs: { type: 'text', maxlength: '500', placeholder: 'Type a message…' },
    });
    const send = () => {
        const channel = tab === 'clan' ? 'clan' : tab === 'private' ? `conv:${activeConvId}` : 'general';
        if (tab === 'private' && activeConvId == null) return;
        sendChat(channel, input.value);
        input.value = '';
        input.focus();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    return h('div', { className: 'chat-composer' },
        input,
        h('button', { className: 'chat-send', text: '➤', onclick: send }),
    );
}

// Repaint the visible message list and stick to the bottom.
function syncMessages() {
    const list = panel?.querySelector('.chat-messages');
    if (!list) return;
    const msgs = activeTab === 'private'
        ? getMessages('private', activeConvId)
        : getMessages(activeTab);
    clear(list);
    if (!msgs.length) {
        list.appendChild(h('div', { className: 'chat-empty' }, h('p', { text: 'No messages yet — say hello!' })));
        return;
    }
    const me = getCurrentUser();
    msgs.forEach((m) => {
        const mine = me && m.senderId === me.id;
        // Tap the avatar (or sender name) to open the sender's public profile.
        const openProfile = (e) => { e.stopPropagation(); if (m.senderId) showProfileModal(m.senderId); };
        list.appendChild(h('div', { className: `chat-msg${mine ? ' mine' : ''}` },
            h('span', {
                className: `chat-msg-avatar frame-${safeFrame(m.senderFrame)}`,
                text: avatarEmoji(m.senderAvatar), onclick: openProfile,
            }),
            h('div', { className: 'chat-msg-bubble' },
                mine ? null : h('span', { className: 'chat-msg-sender chat-msg-sender-link', text: m.sender, onclick: openProfile }),
                h('span', { className: 'chat-msg-text', text: m.content }),
            ),
        ));
    });
    list.scrollTop = list.scrollHeight;
}

function switchTab(id) {
    activeTab = id;
    if (id !== 'private') activeConvId = null;
    render();
}

// ── Public profile modal ──────────────────────────────────────────────────────
// Tap a chat message to see the sender's public profile (gear, clan, power, PvP
// record) and — for clanmates — start a friendly, unranked duel against them.
async function showProfileModal(userId) {
    const me = getCurrentUser();
    const loading = h('div', { className: 'member-modal' },
        h('p', { className: 'muted', text: 'Loading profile…' }),
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    openModal(loading);

    let p;
    try {
        p = await fetchPlayerProfile(userId);
    } catch {
        clear(loading);
        loading.appendChild(h('p', { className: 'muted', text: 'Could not load this profile.' }));
        loading.appendChild(h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }));
        return;
    }

    const isMe = me?.id === p.userId;
    const myClan = getMyClanCached();
    const sameClan = !!(myClan && p.clan && p.clan.id === myClan.id);

    const statRow = (label, value) => h('div', { className: 'member-stat-row' },
        h('span', { className: 'member-stat-label muted', text: label }),
        h('span', { className: 'member-stat-val', text: value }),
    );

    const clanLine = p.clan
        ? `${p.clan.emblem || '🛡️'} ${p.clan.name}${p.clan.tag ? ` [${p.clan.tag}]` : ''} · Lv ${fmt(p.clan.level || 1)}`
        : 'No clan';

    const body = h('div', { className: 'member-modal' },
        h('div', { className: 'member-modal-head' },
            h('span', { className: `member-modal-avatar frame-${safeFrame(p.frame)}`, text: avatarEmoji(p.profilePicture) }),
            h('div', { className: 'member-modal-id' },
                h('div', { className: 'member-modal-name' },
                    h('span', { text: p.username }),
                    p.rank ? h('span', { className: 'member-badge', text: ` ${p.rank.icon}` }) : null,
                ),
                h('div', { className: 'muted', text: clanLine }),
            ),
        ),
        h('div', { className: 'member-stats' },
            statRow('⭐ Level', fmt(p.level || 1)),
            statRow('💪 Power', fmt(p.power || 0)),
            statRow('🏆 PvP ELO', `${fmt(p.pvpRating ?? 1000)}${p.rank ? ` ${p.rank.name}` : ''}`),
            statRow('📊 PvP Record', `${fmt(p.pvpWins || 0)}W / ${fmt(p.pvpLosses || 0)}L`),
            statRow('❤️ Max HP', fmt(p.maxHP || 0)),
            statRow('🔨 Forge Lv', fmt(p.forgeLevel || 1)),
        ),
        renderGear(p.equipment),
        sameClan && !isMe ? h('button', {
            className: 'btn btn-primary btn-block', text: '⚔️ Friendly Duel',
            onclick: () => { closeModal(); closeChat(); navigateToScreen('pvp'); startFriendly(p.userId); },
        }) : null,
        sameClan && !isMe
            ? h('p', { className: 'muted small member-duel-note', text: 'A practice fight against their gear — your ELO and record stay unchanged.' })
            : (!isMe ? h('p', { className: 'muted small member-duel-note', text: 'Join their clan to challenge them to a friendly duel.' }) : null),
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    // Swap the loading body for the full profile in the same modal shell — unless
    // the user already dismissed it while the request was in flight.
    if (loading.parentNode) loading.replaceWith(body);
}

// Compact equipped-gear grid for the profile modal — one tile per slot, coloured
// by rarity, with empty slots shown faded.
function renderGear(equipment) {
    const eq = equipment && typeof equipment === 'object' ? equipment : {};
    return h('div', { className: 'profile-gear' },
        h('div', { className: 'profile-gear-title muted', text: 'Equipped Gear' }),
        h('div', { className: 'profile-gear-grid' },
            ...EQUIPMENT_TYPES.map((slot) => {
                const item = eq[slot];
                if (!item || typeof item !== 'object') {
                    return h('div', { className: 'profile-gear-cell empty', attrs: { title: slotLabel(slot) } },
                        h('span', { className: 'profile-gear-icon', text: '—' }),
                    );
                }
                const color = rarityColor(item.tier);
                return h('div', {
                    className: 'profile-gear-cell', style: { '--rarity': color },
                    attrs: { title: `${itemName(item)} · ${rarityName(item.tier)} · ${slotLabel(slot)} · Lv ${item.level || 1}` },
                },
                    h('span', { className: 'profile-gear-icon', text: itemIcon(item) }),
                    h('span', { className: 'profile-gear-lv', text: `L${fmt(item.level || 1)}` }),
                );
            }),
        ),
    );
}

// ── New DM / group modals ─────────────────────────────────────────────────────
function promptNewDm() {
    const input = h('input', { className: 'chat-input', attrs: { type: 'text', placeholder: 'Player username', maxlength: '30' } });
    const go = () => { const v = input.value.trim(); if (!v) return; startDm(v); closeModal(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    openModal(h('div', { className: 'chat-new' },
        h('h3', { text: '✉️ New message' }),
        h('p', { className: 'muted', text: 'Start a private chat with another player.' }),
        input,
        h('div', { className: 'chat-new-actions' },
            h('button', { className: 'btn btn-ghost', text: 'Cancel', onclick: closeModal }),
            h('button', { className: 'btn btn-primary', text: 'Start', onclick: go }),
        ),
    ));
    requestAnimationFrame(() => input.focus());
}

function promptNewGroup() {
    const nameInput = h('input', { className: 'chat-input', attrs: { type: 'text', placeholder: 'Group name', maxlength: '40' } });
    const membersInput = h('input', { className: 'chat-input', attrs: { type: 'text', placeholder: 'Usernames, comma-separated' } });
    const go = () => {
        const name = nameInput.value.trim();
        if (!name) { toast('Group needs a name', 'error'); return; }
        const usernames = membersInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        if (!usernames.length) { toast('Add at least one player', 'error'); return; }
        createGroup(name, usernames);
        closeModal();
    };
    openModal(h('div', { className: 'chat-new' },
        h('h3', { text: '👥 New group' }),
        h('p', { className: 'muted', text: 'Create a custom group chat with several players.' }),
        nameInput,
        membersInput,
        h('div', { className: 'chat-new-actions' },
            h('button', { className: 'btn btn-ghost', text: 'Cancel', onclick: closeModal }),
            h('button', { className: 'btn btn-primary', text: 'Create', onclick: go }),
        ),
    ));
    requestAnimationFrame(() => nameInput.focus());
}
