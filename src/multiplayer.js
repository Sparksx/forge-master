/**
 * Multiplayer connection manager.
 * Handles Socket.IO connections for chat and PvP.
 *
 * Usage:
 *   import { connectChat, connectPvp } from './multiplayer.js';
 *
 *   // After login:
 *   const chat = connectChat(token);
 *   chat.onMessage((msg) => { ... });
 *   chat.sendMessage('Hello!');
 *
 *   const pvp = connectPvp(token);
 *   pvp.joinQueue();
 *   pvp.onMatchResult((result) => { ... });
 */

const serverUrl = import.meta.env.VITE_SERVER_URL || '';

// --- Chat ---

export function connectChat(token) {
  // Lazy-load socket.io-client
  let socket = null;
  const listeners = { message: [], history: [] };

  async function init() {
    const { io } = await import('socket.io-client');
    socket = io(`${serverUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('message', (msg) => {
      listeners.message.forEach(fn => fn(msg));
    });

    socket.on('history', (data) => {
      listeners.history.forEach(fn => fn(data));
    });

    socket.on('connect_error', (err) => {
      console.error('Chat connection error:', err.message);
    });
  }

  init();

  return {
    sendMessage(content, channel = 'general') {
      if (socket) socket.emit('message', { content, channel });
    },
    joinChannel(channel) {
      if (socket) socket.emit('join', channel);
    },
    leaveChannel(channel) {
      if (socket) socket.emit('leave', channel);
    },
    onMessage(fn) {
      listeners.message.push(fn);
    },
    onHistory(fn) {
      listeners.history.push(fn);
    },
    disconnect() {
      if (socket) socket.disconnect();
    },
  };
}

// --- PvP ---

export function connectPvp(token) {
  let socket = null;
  const listeners = {
    matchResult: [],
    matchError: [],
    online: [],
    queueJoined: [],
    queueLeft: [],
  };

  async function init() {
    const { io } = await import('socket.io-client');
    socket = io(`${serverUrl}/pvp`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('match:result', (data) => {
      listeners.matchResult.forEach(fn => fn(data));
    });

    socket.on('match:error', (data) => {
      listeners.matchError.forEach(fn => fn(data));
    });

    socket.on('online', (data) => {
      listeners.online.forEach(fn => fn(data));
    });

    socket.on('queue:joined', (data) => {
      listeners.queueJoined.forEach(fn => fn(data));
    });

    socket.on('queue:left', () => {
      listeners.queueLeft.forEach(fn => fn());
    });

    socket.on('connect_error', (err) => {
      console.error('PvP connection error:', err.message);
    });
  }

  init();

  return {
    joinQueue() {
      if (socket) socket.emit('queue:join');
    },
    leaveQueue() {
      if (socket) socket.emit('queue:leave');
    },
    onMatchResult(fn) {
      listeners.matchResult.push(fn);
    },
    onMatchError(fn) {
      listeners.matchError.push(fn);
    },
    onOnlineCount(fn) {
      listeners.online.push(fn);
    },
    onQueueJoined(fn) {
      listeners.queueJoined.push(fn);
    },
    onQueueLeft(fn) {
      listeners.queueLeft.push(fn);
    },
    disconnect() {
      if (socket) socket.disconnect();
    },
  };
}
