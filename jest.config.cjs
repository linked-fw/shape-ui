/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig-esm.json',
      },
    ],
  },
  // Strip the `.js` extension from relative ESM imports so ts-jest resolves the
  // `.ts` source (NodeNext-style specifiers carry `.js`; jest maps back to src).
  moduleNameMapper: {
    // Component tests render markup only; a stylesheet import (ours or a dependency's) is a stub.
    '\\.css$': '<rootDir>/src/test-helpers/styleStub.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
