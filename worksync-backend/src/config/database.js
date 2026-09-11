import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Reuse a single PrismaClient instance across the app (and across hot reloads
// in dev) to avoid exhausting database connections.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__worksyncPrisma ||
  new PrismaClient({
    log: env.isProduction ? ['error', 'warn'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.__worksyncPrisma = prisma;
}

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
