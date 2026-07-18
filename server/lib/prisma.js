import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Shutdown handled centrally in server/index.js — no duplicate handlers here.

export default prisma;
