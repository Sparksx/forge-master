import { prisma } from '../db.js';
import { simulateCombat, calculateCombatStats } from '../services/pvpCombat.js';

// Queue of players waiting for a match
const matchQueue = [];
// Active matches: matchId -> { player1Socket, player2Socket }
const activeMatches = new Map();

export function setupPvp(io) {
  const pvpNamespace = io.of('/pvp');

  pvpNamespace.on('connection', (socket) => {
    const { playerId, username } = socket;

    // Send online player count
    broadcastOnlineCount(pvpNamespace);

    // Handle queue join
    socket.on('queue:join', () => {
      // Don't double-queue
      if (matchQueue.some(q => q.playerId === playerId)) {
        socket.emit('queue:already');
        return;
      }

      matchQueue.push({ playerId, username, socket });
      socket.emit('queue:joined', { position: matchQueue.length });

      // Try to match players
      tryMatchPlayers(pvpNamespace);
    });

    // Handle queue leave
    socket.on('queue:leave', () => {
      removeFromQueue(playerId);
      socket.emit('queue:left');
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      removeFromQueue(playerId);
      broadcastOnlineCount(pvpNamespace);
    });
  });
}

function removeFromQueue(playerId) {
  const idx = matchQueue.findIndex(q => q.playerId === playerId);
  if (idx !== -1) matchQueue.splice(idx, 1);
}

async function tryMatchPlayers(pvpNamespace) {
  while (matchQueue.length >= 2) {
    const p1 = matchQueue.shift();
    const p2 = matchQueue.shift();

    // Verify both still connected
    if (!p1.socket.connected) {
      if (p2.socket.connected) matchQueue.unshift(p2);
      continue;
    }
    if (!p2.socket.connected) {
      if (p1.socket.connected) matchQueue.unshift(p1);
      continue;
    }

    await startMatch(p1, p2);
  }
}

async function startMatch(p1Entry, p2Entry) {
  try {
    // Load both players' equipment from DB
    const [p1Data, p2Data] = await Promise.all([
      prisma.player.findUnique({
        where: { id: p1Entry.playerId },
        include: { equipment: true },
      }),
      prisma.player.findUnique({
        where: { id: p2Entry.playerId },
        include: { equipment: true },
      }),
    ]);

    if (!p1Data || !p2Data) return;

    const p1Stats = calculateCombatStats(p1Data.equipment);
    const p2Stats = calculateCombatStats(p2Data.equipment);

    // Run combat simulation
    const result = simulateCombat(p1Stats, p2Stats);

    // Determine winner
    let winnerId = null;
    if (result.winnerId === 'player1') winnerId = p1Entry.playerId;
    else if (result.winnerId === 'player2') winnerId = p2Entry.playerId;

    // Save match to DB
    const match = await prisma.pvpMatch.create({
      data: {
        player1Id: p1Entry.playerId,
        player2Id: p2Entry.playerId,
        winnerId,
        status: 'completed',
        logs: result.logs,
      },
    });

    // Build match result for clients
    const matchResult = {
      matchId: match.id,
      player1: { id: p1Entry.playerId, username: p1Entry.username, stats: p1Stats },
      player2: { id: p2Entry.playerId, username: p2Entry.username, stats: p2Stats },
      winnerId,
      logs: result.logs,
      rounds: result.rounds,
    };

    // Send results to both players
    p1Entry.socket.emit('match:result', matchResult);
    p2Entry.socket.emit('match:result', matchResult);

  } catch (error) {
    console.error('Start match error:', error);
    p1Entry.socket.emit('match:error', { message: 'Failed to start match' });
    p2Entry.socket.emit('match:error', { message: 'Failed to start match' });
  }
}

function broadcastOnlineCount(namespace) {
  namespace.fetchSockets().then(sockets => {
    namespace.emit('online', { count: sockets.length });
  });
}
