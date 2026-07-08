// setupFiles entry: runs in every worker before the test module (and the
// Prisma client) are imported, so the process points at the isolated test DB
// rather than dev.db. Must not use jest globals — those aren't available yet.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
