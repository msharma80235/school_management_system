/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  globalSetup: '<rootDir>/src/tests/globalSetup.js',
  setupFiles: ['<rootDir>/src/tests/jestEnv.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // Transpile-only, matching how the app runs under tsx. Full type-checking
      // is a separate `tsc` concern; here it would block tests on unrelated
      // pre-existing type issues in the import graph.
      isolatedModules: true,
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        types: ['jest', 'node'],
        // TS 6 flags these as deprecated at config-parse time; the app tsconfig
        // still uses them and tsx doesn't care, so silence for the test build.
        ignoreDeprecations: '6.0',
      },
    }],
  },
};
