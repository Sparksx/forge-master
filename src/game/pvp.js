// Live PvP client — thin wrapper over the existing server match engine.
// The view registers handlers; this module owns the socket protocol.
import { getSocket } from '../socket-client.js';

let handlers = {};
let bound = null;

export function setPvpHandlers(h) {
    handlers = h || {};
}

const EVENTS = ['pvp:queued', 'pvp:cancelled', 'pvp:matched', 'pvp:turn', 'pvp:turn-result', 'pvp:end', 'pvp:error', 'pvp:leaderboard'];

const handlerName = {
    'pvp:queued': 'onQueued',
    'pvp:cancelled': 'onCancelled',
    'pvp:matched': 'onMatched',
    'pvp:turn': 'onTurn',
    'pvp:turn-result': 'onTurnResult',
    'pvp:end': 'onEnd',
    'pvp:error': 'onError',
    'pvp:leaderboard': 'onLeaderboard',
};

/** Bind socket listeners. Safe to call repeatedly (rebinds on reconnect). */
export function initPvp() {
    const socket = getSocket();
    if (!socket || socket === bound) return;
    bound = socket;
    EVENTS.forEach((evt) => {
        socket.off(evt);
        socket.on(evt, (data) => handlers[handlerName[evt]]?.(data));
    });
}

function emit(evt, payload) {
    const socket = getSocket();
    if (!socket) return false;
    socket.emit(evt, payload);
    return true;
}

export const pvpQueue = () => emit('pvp:queue');
export const pvpCancel = () => emit('pvp:cancel');
/** Challenge a clanmate to an unranked friendly duel (no ELO change). */
export const pvpFriendly = (targetUserId) => emit('pvp:friendly', { targetUserId });
export const pvpAction = (type) => emit('pvp:action', { type });
export const pvpRequestLeaderboard = () => emit('pvp:leaderboard');
