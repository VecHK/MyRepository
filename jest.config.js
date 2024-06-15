/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,
  coverageDirectory: 'coverage',
  modulePathIgnorePatterns: [
    '<rootDir>/storage',
    '<rootDir>/test/file-pool/storage',
    '<rootDir>/test/init/storage',
    '<rootDir>/test/storage/test-path',
  ],
  transform: {
    '^.+\\.test.ts?$': ['ts-jest', {
      babelConfig: {
        presets: [
          'power-assert'
        ]
      }
    }]
  }
}
