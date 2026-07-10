// Prisma's datasource `provider` must be a static string literal (it can't read
// an env var), so switching between SQLite (local dev / tests) and PostgreSQL
// (production) means rewriting that one line in schema.prisma. This helper does
// exactly that — and only the datasource line, never the generator's
// `provider = "prisma-client-js"`.

export type DbProvider = 'sqlite' | 'postgresql';

export function swapProvider(schema: string, provider: DbProvider): string {
  if (provider !== 'sqlite' && provider !== 'postgresql') {
    throw new Error(`Unsupported provider "${provider}" (expected sqlite | postgresql)`);
  }
  // Match only a datasource provider (value is sqlite or postgresql), leaving
  // the generator's prisma-client-js provider untouched.
  return schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, `provider = "${provider}"`);
}

export function currentProvider(schema: string): DbProvider | null {
  const m = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/);
  return (m?.[1] as DbProvider) || null;
}
