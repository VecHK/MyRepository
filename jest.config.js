/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,
  coverageDirectory: 'coverage',
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
