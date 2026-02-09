/**
 * API client with JWT token management and auto-refresh.
 */

let accessToken = null;
let refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('fm_refresh_token') : null;
let onAuthLost = null; // callback when auth is completely lost

export function setAuthLostCallback(cb) {
    onAuthLost = cb;
}

export function setTokens(access, refresh) {
    accessToken = access;
    refreshToken = refresh;
    if (refresh && typeof localStorage !== 'undefined') {
        localStorage.setItem('fm_refresh_token', refresh);
    }
}

export function getAccessToken() {
    return accessToken;
}

export function getStoredRefreshToken() {
    return refreshToken;
}

export function clearTokens() {
    accessToken = null;
    refreshToken = null;
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('fm_refresh_token');
    }
}

async function refreshAccessToken() {
    if (!refreshToken) return false;

    try {
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
            clearTokens();
            return false;
        }

        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
    } catch {
        return false;
    }
}

/**
 * Fetch wrapper that auto-attaches JWT and handles token refresh.
 */
export async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    let res = await fetch(url, { ...options, headers });

    // If 401, try refreshing the token and retry once
    if (res.status === 401 && refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            headers['Authorization'] = `Bearer ${accessToken}`;
            res = await fetch(url, { ...options, headers });
        } else {
            if (onAuthLost) onAuthLost();
            throw new Error('Session expired');
        }
    }

    return res;
}
