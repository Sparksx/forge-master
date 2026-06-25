// World/clan/private chat client. The server pushes `chat:history` (a 100-message
// backlog per channel), `chat:message` per new line, and `chat:conversations` /
// `chat:conversation-opened` for the private DM + custom-group list. Screens read
// the buffers below and refresh on the CHAT_UPDATED event.
import { getSocket } from '../socket-client.js';
import { gameEvents, EVENTS } from '../events.js';

const MAX = 100;
let bound = null;

// Rolling buffers, one per logical channel. `general` and `clan` are singletons;
// each private conversation gets its own buffer keyed by conversation id.
const buffers = { general: [], clan: [] };
const convBuffers = new Map(); // convId -> messages[]
let conversations = [];

const SOCKET_EVENTS = [
    'chat:history', 'chat:message', 'chat:message-deleted',
    'chat:conversations', 'chat:conversation', 'chat:conversation-opened', 'chat:error',
];

// Map a stored channel ("general" | "clan:<id>" | "conv:<id>") to its buffer key.
function bucketKey(channel) {
    if (channel === 'general') return 'general';
    if (typeof channel !== 'string') return null;
    if (channel.startsWith('clan:')) return 'clan';
    if (channel.startsWith('conv:')) return channel; // keep full id-qualified key
    return null;
}

function convIdOf(channel) {
    return typeof channel === 'string' && channel.startsWith('conv:') ? Number(channel.slice(5)) : null;
}

function setBuffer(channel, list) {
    const trimmed = (Array.isArray(list) ? list : []).slice(-MAX);
    if (channel === 'general' || (typeof channel === 'string' && channel.startsWith('clan:'))) {
        buffers[channel === 'general' ? 'general' : 'clan'] = trimmed;
    } else {
        const id = convIdOf(channel);
        if (id != null) convBuffers.set(id, trimmed);
    }
}

function pushMessage(msg) {
    const channel = msg.channel;
    if (channel === 'general' || (typeof channel === 'string' && channel.startsWith('clan:'))) {
        const key = channel === 'general' ? 'general' : 'clan';
        buffers[key].push(msg);
        if (buffers[key].length > MAX) buffers[key] = buffers[key].slice(-MAX);
    } else {
        const id = convIdOf(channel);
        if (id == null) return;
        const arr = convBuffers.get(id) || [];
        arr.push(msg);
        convBuffers.set(id, arr.length > MAX ? arr.slice(-MAX) : arr);
        bumpConversation(id);
    }
}

// Float a conversation to the top of the list when it receives a new message.
function bumpConversation(id) {
    const i = conversations.findIndex((c) => c.id === id);
    if (i > 0) {
        const [c] = conversations.splice(i, 1);
        conversations.unshift(c);
    }
}

function upsertConversation(conv) {
    if (!conv || conv.id == null) return;
    const i = conversations.findIndex((c) => c.id === conv.id);
    if (i >= 0) conversations[i] = conv;
    else conversations.unshift(conv);
}

/** Bind socket listeners. Safe to call repeatedly (rebinds on reconnect). */
export function initChat() {
    const socket = getSocket();
    if (!socket || socket === bound) return;
    bound = socket;

    SOCKET_EVENTS.forEach((e) => socket.off(e));

    socket.on('chat:history', (payload) => {
        // Back-compat: a bare array is treated as general history.
        const channel = Array.isArray(payload) ? 'general' : payload?.channel;
        const messages = Array.isArray(payload) ? payload : payload?.messages;
        setBuffer(channel, messages);
        gameEvents.emit(EVENTS.CHAT_UPDATED, { channel });
    });

    socket.on('chat:message', (msg) => {
        if (!msg || !msg.content) return;
        pushMessage(msg);
        gameEvents.emit(EVENTS.CHAT_UPDATED, { channel: msg.channel });
    });

    socket.on('chat:message-deleted', ({ messageId } = {}) => {
        buffers.general = buffers.general.filter((m) => m.id !== messageId);
        buffers.clan = buffers.clan.filter((m) => m.id !== messageId);
        for (const [id, arr] of convBuffers) convBuffers.set(id, arr.filter((m) => m.id !== messageId));
        gameEvents.emit(EVENTS.CHAT_UPDATED, {});
    });

    socket.on('chat:conversations', (list) => {
        conversations = Array.isArray(list) ? list : [];
        gameEvents.emit(EVENTS.CHAT_UPDATED, { conversations: true });
    });

    // A conversation we belong to was created/updated — add it to the list, but
    // don't force the view to change.
    socket.on('chat:conversation', (conv) => {
        upsertConversation(conv);
        gameEvents.emit(EVENTS.CHAT_UPDATED, { conversations: true });
    });

    // We initiated this conversation — add it and switch to it.
    socket.on('chat:conversation-opened', (conv) => {
        upsertConversation(conv);
        gameEvents.emit(EVENTS.CHAT_CONVERSATION_OPENED, conv);
    });

    socket.on('chat:error', ({ message } = {}) => {
        if (message) gameEvents.emit(EVENTS.CHAT_ERROR, message);
    });

    // Pull the private conversation list up front so the Private tab is ready.
    socket.emit('chat:conversations');
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** Messages for a tab. For 'private', pass the conversation id. */
export function getMessages(tab, convId) {
    if (tab === 'general') return buffers.general.slice();
    if (tab === 'clan') return buffers.clan.slice();
    if (tab === 'private' && convId != null) return (convBuffers.get(convId) || []).slice();
    return [];
}

export function getConversations() {
    return conversations.slice();
}

/** The most recent `n` general-chat messages (oldest → newest) for the preview. */
export function getRecentMessages(n = 3) {
    return buffers.general.slice(-n);
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Send a line. `channel` is 'general' | 'clan' | `conv:<id>`. */
export function sendChat(channel, content) {
    const text = (content || '').trim();
    if (!text) return;
    getSocket()?.emit('chat:message', { channel, content: text });
}

/** Ask the server to replay a channel's recent history (on tab/conversation open). */
export function requestHistory(channel) {
    getSocket()?.emit('chat:request-history', { channel });
}

export function requestConversations() {
    getSocket()?.emit('chat:conversations');
}

/** Open (or create) a 1:1 DM with another player by username. */
export function startDm(username) {
    const name = (username || '').trim();
    if (name) getSocket()?.emit('chat:start-dm', { username: name });
}

/** Create a named custom group with the given usernames. */
export function createGroup(name, usernames) {
    getSocket()?.emit('chat:create-group', { name, usernames });
}
