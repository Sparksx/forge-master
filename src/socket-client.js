/**
 * Socket.io client — connects to server with JWT auth.
 */

import { io } from 'socket.io-client';
import { getAccessToken } from './api.js';

let socket = null;

export function connectSocket() {
    if (socket?.connected) return socket;

    const token = getAccessToken();
    if (!token) return null;

    // In dev, Vite proxy handles the connection. In prod, same origin.
    socket = io({
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
        console.log('Socket connected');
    });

    socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        // If the error is auth-related, update the token for the next reconnection attempt
        const freshToken = getAccessToken();
        if (freshToken && socket) {
            socket.auth = { token: freshToken };
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        // If disconnected by the server (e.g. auth expired), refresh auth for reconnect
        if (reason === 'io server disconnect') {
            const freshToken = getAccessToken();
            if (freshToken && socket) {
                socket.auth = { token: freshToken };
                socket.connect();
            }
        }
    });

    return socket;
}

export function getSocket() {
    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
