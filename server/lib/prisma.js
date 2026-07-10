import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Shutdown is handled centrally by server/index.js — no duplicate
// handlers here (they race with the main shutdown and can exit early).

export default prisma;
