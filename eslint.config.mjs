/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import neostandard from 'neostandard'

// Migrated from .eslintrc.json (ESLint 8 / standard-with-typescript).
// standard-with-typescript is deprecated; neostandard is its flat-config
// successor. Only TypeScript sources are linted, matching the previous
// `--ext .ts` plus `"ignorePatterns": "**/*.js"` behaviour.
export default [
  ...neostandard({
    ts: true,
    noJsx: true,
    ignores: [
      'dist/**',
      'lib/**',
      'samples/**',
      'templates/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs'
    ]
  }),
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // neostandard defaults to `project: false` (no type-aware linting).
        // The previous config was type-aware, so keep it that way.
        project: './tsconfig.json'
      }
    },
    rules: {
      // eslint-config-standard 17 used { allowAsStatement: true }; neostandard
      // sets a bare 'error'. `void run()` is the idiomatic marker for a
      // deliberately un-awaited promise, so restore the previous behaviour.
      'no-void': ['error', { allowAsStatement: true }],
      'arrow-body-style': 2,
      'object-shorthand': 2,
      '@typescript-eslint/strict-boolean-expressions': 0,
      '@typescript-eslint/restrict-template-expressions': 0,
      '@typescript-eslint/no-misused-promises': 0,
      '@typescript-eslint/consistent-type-assertions': 0,
      '@typescript-eslint/no-dynamic-delete': 0,
      '@typescript-eslint/prefer-nullish-coalescing': 0
    }
  }
]
