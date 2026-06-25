// Lightweight world-chat client. Mirrors the pvp.js pattern: the server pushes
// `chat:history` on connect and `chat:message` per new line, so we only need to
// listen and keep a small rolling buffer. Screens read the latest few messages
// (e.g. the home-screen chat strip) and refresh on the CHAT_UPDATED event.
import { getSocket } from '../socket-client.js';
import { gameEvents, EVENTS } from '../events.js';

const MAX = 50;
let messages = [];
let bound = null;

/** Bind socket listeners. Safe to call repeatedly (rebinds on reconnect). */
export function initChat() {
    const socket = getSocket();
    if (!socket || socket === bound) return;
    bound = socket;

    socket.off('chat:history');
    socket.off('chat:message');
    socket.off('chat:message-deleted');

    socket.on('chat:history', (list) => {
        messages = (Array.isArray(list) ? list : []).slice(-MAX);
        gameEvents.emit(EVENTS.CHAT_UPDATED);
    });
    socket.on('chat:message', (msg) => {
        if (!msg || !msg.content) return;
        messages.push(msg);
        if (messages.length > MAX) messages = messages.slice(-MAX);
        gameEvents.emit(EVENTS.CHAT_UPDATED);
    });
    socket.on('chat:message-deleted', ({ messageId } = {}) => {
        messages = messages.filter((m) => m.id !== messageId);
        gameEvents.emit(EVENTS.CHAT_UPDATED);
    });
}

/** The most recent `n` chat messages (oldest → newest). */
export function getRecentMessages(n = 3) {
    return messages.slice(-n);
}
