import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config.js';
import { prisma } from './db.js';
import { authenticateSocket } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import { setupChat } from './socket/chat.js';
import { setupPvp } from './socket/pvp.js';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: config.clientUrl,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check (Railway uses this)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: corsOptions,
});

// Apply auth middleware to all namespaces
io.of('/chat').use(authenticateSocket);
io.of('/pvp').use(authenticateSocket);

// Setup socket handlers
setupChat(io);
setupPvp(io);

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  io.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
httpServer.listen(config.port, () => {
  console.log(`Forge Master server running on port ${config.port}`);
});
