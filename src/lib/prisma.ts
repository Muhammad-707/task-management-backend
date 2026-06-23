// Prisma client singleton.
//
// One PrismaClient per process (its connection pool is shared across requests).
// Exposed via the Fastify `prisma` plugin (`src/plugins/prisma.ts`) so handlers
// reach it through `app.prisma` / `request.server.prisma` rather than importing
// this module directly — keeps data access swappable in tests.

import { PrismaClient } from '@prisma/client';
import { isDev } from '../config/index.js';

/**
 * Create a configured PrismaClient. Query logging is verbose in development and
 * quiet (warn/error only) elsewhere. Prisma connects lazily on first query;
 * call `connectPrisma` to verify connectivity eagerly at boot.
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

export const prisma = createPrismaClient();

export type { PrismaClient };
