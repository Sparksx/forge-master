import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Shutdown is managed by server/index.js which calls prisma.$disconnect()
// as part of the full graceful-shutdown sequence (close sockets → close HTTP → disconnect DB).

export default prisma;
