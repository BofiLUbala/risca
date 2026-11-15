/** Tests unitaires du backend (fichiers *.spec.ts sous src/). */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: false }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
};
