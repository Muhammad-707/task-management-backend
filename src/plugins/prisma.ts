// Prisma Fastify plugin.
//
// Decorates the instance with `app.prisma`, verifies DB connectivity at boot
// (so a misconfigured/unreachable database fails the startup rather than the
// first request), and disconnects cleanly on shutdown via the `onClose` hook.

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { prisma, type PrismaClient } from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function prismaPlugin(app: FastifyInstance): Promise<void> {
  await prisma.$connect();
  app.log.info('database connected');

  app.decorate('prisma', prisma);

  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
    instance.log.info('database disconnected');
  });
}

export default fp(prismaPlugin, { name: 'prisma' });
