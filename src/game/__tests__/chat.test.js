import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide a controllable fake socket to the chat client.
let socket;
vi.mock('../../socket-client.js', () => ({ getSocket: () => socket }));

import {
    initChat, getMessages, getConversations, getRecentMessages,
} from '../chat.js';

function fakeSocket() {
    const listeners = {};
    return {
        on: (e, cb) => { listeners[e] = cb; },
        off: () => {},
        emit: () => {},
        fire: (e, payload) => listeners[e]?.(payload),
    };
}

const msg = (over) => ({ id: 1, sender: 'A', senderId: 1, content: 'hi', channel: 'general', ...over });

describe('chat client routing', () => {
    beforeEach(() => {
        // A fresh socket each time forces initChat to rebind its listeners.
        socket = fakeSocket();
        initChat();
    });

    it('routes general history into the general buffer', () => {
        socket.fire('chat:history', { channel: 'general', messages: [msg({ id: 1 }), msg({ id: 2 })] });
        expect(getMessages('general')).toHaveLength(2);
        expect(getRecentMessages(1)).toEqual([expect.objectContaining({ id: 2 })]);
    });

    it('routes clan messages into the clan buffer, not general', () => {
        socket.fire('chat:history', { channel: 'general', messages: [] });
        socket.fire('chat:message', msg({ id: 7, channel: 'clan:3', content: 'clanhi' }));
        expect(getMessages('clan')).toEqual([expect.objectContaining({ id: 7 })]);
        expect(getMessages('general')).toHaveLength(0);
    });

    it('keeps each private conversation in its own buffer', () => {
        socket.fire('chat:history', { channel: 'conv:5', messages: [msg({ id: 10, channel: 'conv:5' })] });
        socket.fire('chat:message', msg({ id: 11, channel: 'conv:9', content: 'other' }));
        expect(getMessages('private', 5)).toEqual([expect.objectContaining({ id: 10 })]);
        expect(getMessages('private', 9)).toEqual([expect.objectContaining({ id: 11 })]);
        expect(getMessages('private', 5)).toHaveLength(1);
    });

    it('exposes the private conversation list', () => {
        socket.fire('chat:conversations', [{ id: 1, type: 'dm', title: 'Bob' }, { id: 2, type: 'group', title: 'Squad' }]);
        expect(getConversations().map((c) => c.title)).toEqual(['Bob', 'Squad']);
    });

    it('removes a deleted message from whichever buffer holds it', () => {
        socket.fire('chat:history', { channel: 'general', messages: [msg({ id: 1 }), msg({ id: 2 })] });
        socket.fire('chat:message-deleted', { messageId: 1 });
        expect(getMessages('general').map((m) => m.id)).toEqual([2]);
    });
});
