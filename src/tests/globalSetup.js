// Jest global setup: build a throwaway SQLite schema for tests so the suite
// never touches the real dev.db. Runs once before the whole run.
//
// We delete the test DB file and let `prisma db push` recreate it from the
// current schema. Deleting the file (rather than using --force-reset) keeps the
// push non-destructive, so it needs no special consent flags.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';

  // SQLite path in the schema is relative to prisma/ → prisma/test.db
  const dbDir = path.resolve(__dirname, '../../prisma');
  for (const f of ['test.db', 'test.db-journal']) {
    const p = path.join(dbDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  execSync('npx prisma db push --skip-generate', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
};
