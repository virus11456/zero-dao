import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance.
 *
 * Prevents connection pool exhaustion from multiple PrismaClient instances
 * across modules. In development, the global reference survives HMR reloads.
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
