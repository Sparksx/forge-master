/**
 * Chat UI — real-time chat with preview and full-page overlay.
 */

import { getSocket } from './socket-client.js';
import { getCurrentUser } from './auth.js';
import { getProfileEmoji } from './state.js';
import { PROFILE_PICTURES } from './config.js';

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

    setupSocketListeners();
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
    // Use avatar from server message data, fallback to wizard
    if (msg.senderAvatar) {
        const pic = PROFILE_PICTURES.find(p => p.id === msg.senderAvatar);
        if (pic) return pic.emoji;
    }
    return '\uD83E\uDDD9';
}

function appendMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const user = getCurrentUser();
    const isOwn = user && msg.senderId === user.id;

    const el = document.createElement('div');
    el.className = `chat-msg ${isOwn ? 'chat-msg-own' : ''}`;

    const avatar = getAvatarEmoji(msg);
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `<span class="chat-avatar">${avatar}</span>` +
        `<div class="chat-msg-body">` +
        `<span class="chat-sender">${escapeHtml(msg.sender)}</span>` +
        `<span class="chat-time">${time}</span>` +
        `<div class="chat-text">${escapeHtml(msg.content)}</div>` +
        `</div>`;

    container.appendChild(el);
}

function updatePreview() {
    const previewContainer = document.getElementById('chat-preview-messages');
    if (!previewContainer) return;

    previewContainer.textContent = '';

    if (recentMessages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'chat-preview-empty';
        empty.textContent = 'No messages yet';
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

export function refreshChatSocket() {
    setupSocketListeners();
}
