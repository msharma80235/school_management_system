import { swapProvider, currentProvider } from '../utils/dbProvider';

const SCHEMA = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User { id String @id }
`;

describe('Phase 6 — db provider swap', () => {
  it('reads the current datasource provider', () => {
    expect(currentProvider(SCHEMA)).toBe('sqlite');
  });

  it('swaps sqlite → postgresql without touching the generator', () => {
    const out = swapProvider(SCHEMA, 'postgresql');
    expect(currentProvider(out)).toBe('postgresql');
    // generator provider is left alone
    expect(out).toContain('provider = "prisma-client-js"');
    expect(out).toContain('provider = "postgresql"');
  });

  it('is idempotent and reversible', () => {
    const pg = swapProvider(SCHEMA, 'postgresql');
    const back = swapProvider(pg, 'sqlite');
    expect(back).toBe(SCHEMA);
  });

  it('rejects an unknown provider', () => {
    expect(() => swapProvider(SCHEMA, 'mysql' as any)).toThrow();
  });
});
