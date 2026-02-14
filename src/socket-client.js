/**
 * Socket.io client — connects to server with JWT auth.
 * Handles automatic reconnection with token refresh.
 */

import { io } from 'socket.io-client';
import { getAccessToken, refreshAccessToken } from './api.js';

let socket = null;
let onReconnectCallback = null;
let hasConnectedOnce = false;

export function connectSocket({ onReconnect } = {}) {
    if (socket?.connected) return socket;

    if (onReconnect) onReconnectCallback = onReconnect;

    const token = getAccessToken();
    if (!token) return null;

    hasConnectedOnce = false;

    // In dev, Vite proxy handles the connection. In prod, same origin.
    socket = io({
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
        if (!hasConnectedOnce) {
            hasConnectedOnce = true;
            return;
        }
        // This is a reconnection — re-register listeners and refresh auth
        onReconnectCallback?.();
    });

    socket.on('connect_error', async (err) => {
        console.error('Socket connection error:', err.message);
        // Refresh the token before the next reconnection attempt.
        // refreshAccessToken() has an internal mutex so concurrent calls are safe.
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            const freshToken = getAccessToken();
            if (freshToken && socket) {
                socket.auth = { token: freshToken };
            }
        }
    });

    socket.on('disconnect', (reason) => {
        // If disconnected by the server (e.g. auth expired, kick), refresh auth and reconnect
        if (reason === 'io server disconnect') {
            refreshAccessToken().then((_refreshed) => {
                const freshToken = getAccessToken();
                if (freshToken && socket) {
                    socket.auth = { token: freshToken };
                    socket.connect();
                }
            }).catch((err) => {
                console.error('Socket reconnect auth refresh failed:', err);
            });
        }
        // For other reasons (transport close, ping timeout), Socket.io auto-reconnects
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
    onReconnectCallback = null;
}
