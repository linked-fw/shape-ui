/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/../tsconfig-test.json',
      },
    ],
  },
  moduleNameMapper: {
    // CSS modules resolve to a proxy that hands back the class name it was asked for.
    '\\.css$': '<rootDir>/tests/styleStub.cjs',
    // NodeNext-style `.js` specifiers on relative imports map back to the `.ts` source.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
