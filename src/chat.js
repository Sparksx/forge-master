/**
 * Chat UI — real-time chat panel using Socket.io.
 */

import { getSocket } from './socket-client.js';
import { getCurrentUser } from './auth.js';

let chatOpen = false;

export function initChat() {
    const chatToggle = document.getElementById('chat-toggle');
    const chatPanel = document.getElementById('chat-panel');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    chatToggle?.addEventListener('click', () => {
        chatOpen = !chatOpen;
        chatPanel?.classList.toggle('open', chatOpen);
        if (chatOpen) {
            chatInput?.focus();
            scrollToBottom();
        }
    });

    chatClose?.addEventListener('click', () => {
        chatOpen = false;
        chatPanel?.classList.remove('open');
    });

    chatSend?.addEventListener('click', sendMessage);

    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    setupSocketListeners();
}

function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('chat:history', (messages) => {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    });

    socket.on('chat:message', (msg) => {
        appendMessage(msg);
        scrollToBottom();

        // Show unread indicator if chat is closed
        if (!chatOpen) {
            const chatToggle = document.getElementById('chat-toggle');
            chatToggle?.classList.add('has-unread');
        }
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
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const user = getCurrentUser();
    const isOwn = user && msg.senderId === user.id;

    const el = document.createElement('div');
    el.className = `chat-msg ${isOwn ? 'chat-msg-own' : ''}`;

    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `<span class="chat-sender">${escapeHtml(msg.sender)}</span>` +
        `<span class="chat-time">${time}</span>` +
        `<div class="chat-text">${escapeHtml(msg.content)}</div>`;

    container.appendChild(el);
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

export function refreshChatSocket() {
    setupSocketListeners();
}
