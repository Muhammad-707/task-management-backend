// Database seed (run via `npm run prisma:seed`).
//
// Placeholder for Phase 0 — there are no domain models yet. Real seed data
// (a demo workspace/project/states/issues) is the Phase 4 "Seed data" task.
// Kept as a working no-op so the `prisma db seed` hook resolves cleanly.

import { prisma } from '../lib/prisma.js';

async function main(): Promise<void> {
  // Intentionally empty until the Phase 1 schema lands.
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
