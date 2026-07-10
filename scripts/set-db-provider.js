#!/usr/bin/env node
// Switch the Prisma datasource between SQLite and PostgreSQL.
//
//   node scripts/set-db-provider.js postgresql   # for production
//   node scripts/set-db-provider.js sqlite        # back to local dev (default)
//
// After switching to postgresql, set DATABASE_URL to your Postgres connection
// string and run `npx prisma db push` (or generate a fresh migration lineage —
// the checked-in migrations under prisma/migrations are SQLite-only). The
// committed schema stays on sqlite so local dev and the test suite keep working.
const fs = require('fs');
const path = require('path');

const provider = (process.argv[2] || '').toLowerCase();
if (provider !== 'sqlite' && provider !== 'postgresql') {
  console.error('Usage: node scripts/set-db-provider.js <sqlite|postgresql>');
  process.exit(1);
}

// The swap logic lives in src/utils/dbProvider.ts (unit-tested); re-implemented
// here as plain JS so this script has no build step.
function swapProvider(schema, p) {
  return schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, `provider = "${p}"`);
}

const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
const original = fs.readFileSync(schemaPath, 'utf8');
const updated = swapProvider(original, provider);
if (updated === original) {
  console.log(`Datasource provider already "${provider}" (no change).`);
} else {
  fs.writeFileSync(schemaPath, updated);
  console.log(`Datasource provider set to "${provider}".`);
}
