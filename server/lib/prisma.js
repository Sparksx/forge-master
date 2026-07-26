import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Shutdown is handled by server/index.js which calls prisma.$disconnect()
// as part of the coordinated server close sequence.

export default prisma;
