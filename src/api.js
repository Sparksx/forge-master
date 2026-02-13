/**
 * API client with JWT token management and auto-refresh.
 */

let accessToken = null;
let refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('fm_refresh_token') : null;
let onAuthLost = null; // callback when auth is completely lost
const FETCH_TIMEOUT = 10000; // 10s timeout for API requests

// Cross-tab sync: when another tab rotates the refresh token via setTokens(),
// localStorage fires a 'storage' event in all OTHER tabs. Keep in-memory copy in sync.
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === 'fm_refresh_token') {
            refreshToken = e.newValue;
        }
    });
}

function withTimeout(options, timeoutMs = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return {
        opts: { ...options, signal: controller.signal },
        clear: () => clearTimeout(id),
    };
}

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

// Mutex: only one refresh request in flight at a time.
// Concurrent callers share the same pending promise to avoid
// rotating the refresh token twice (which revokes the first).
let refreshPromise = null;

export async function refreshAccessToken() {
    if (!refreshToken) return false;

    // If a refresh is already in flight, wait for it instead of starting a new one
    if (refreshPromise) return refreshPromise;

    refreshPromise = _doRefresh();
    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

async function _doRefresh() {
    try {
        const { opts, clear } = withTimeout({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        const res = await fetch('/api/auth/refresh', opts);
        clear();

        if (!res.ok) {
            // Only clear tokens on definitive auth rejection.
            // Transient server errors should not destroy the session.
            if (res.status === 401 || res.status === 403) {
                clearTokens();
            }
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

    // Serialize body once (avoid mutating the caller's options object)
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fetchOpts = { ...options, headers, body };
    const { opts: timedOpts, clear } = withTimeout(fetchOpts);
    let res = await fetch(url, timedOpts);
    clear();

    // If 401, try refreshing the token and retry once
    if (res.status === 401 && refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            fetchOpts.headers = { ...headers, Authorization: `Bearer ${accessToken}` };
            const { opts: retryOpts, clear: clearRetry } = withTimeout(fetchOpts);
            res = await fetch(url, retryOpts);
            clearRetry();
        } else {
            clearTokens();
            if (onAuthLost) onAuthLost();
            throw new Error('Session expired');
        }
    }

    return res;
}
