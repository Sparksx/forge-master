import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Shutdown is handled by server/index.js which closes HTTP, Socket.IO,
// then calls prisma.$disconnect() in the correct order.

export default prisma;
