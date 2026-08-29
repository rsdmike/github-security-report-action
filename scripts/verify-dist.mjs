/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
// Smoke test for the packaged action bundle.
//
// The unit tests run against lib/ with a real node_modules tree, so they
// cannot catch a packaging failure. A dependency that resolves a file at
// runtime - e.g. createRequire(import.meta.url)('../data/foo.json') - is
// not traced by ncc, producing a dist/index.js that throws on load while
// every test still passes. This runs the real bundle and asserts it gets
// as far as its own input validation rather than dying in the loader.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BUNDLE = path.join(import.meta.dirname, '..', 'dist', 'index.js')

if (!fs.existsSync(BUNDLE)) {
  console.error(`No bundle found at ${BUNDLE} - run "npm run package" first.`)
  process.exit(1)
}

// Strip any INPUT_* variables so the action sees genuinely absent inputs
// and reports the missing token itself.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('INPUT_'))
)

const { stdout = '', stderr = '' } = spawnSync(process.execPath, [BUNDLE], { encoding: 'utf8', env })
const output = `${stdout}${stderr}`

const LOADER_FAILURES = [
  'MODULE_NOT_FOUND',
  'ERR_MODULE_NOT_FOUND',
  'ERR_REQUIRE_ESM',
  'ERR_UNSUPPORTED_DIR_IMPORT',
  'Cannot find module',
  'Cannot find package'
]

const loaderFailure = LOADER_FAILURES.find(marker => output.includes(marker))
if (loaderFailure) {
  console.error(`FAIL: dist/index.js failed to load (${loaderFailure}).`)
  console.error('This usually means a dependency was not bundled by ncc.\n')
  console.error(output)
  process.exit(1)
}

// The action calls core.setFailed() for the missing token, so a non-zero
// exit is expected here. Reaching this message proves every import in the
// bundle resolved and the action's own code ran.
if (!output.includes('Input required and not supplied')) {
  console.error('FAIL: dist/index.js did not reach input validation.\n')
  console.error(output || '(no output)')
  process.exit(1)
}

console.log('OK: dist/index.js loads and reaches input validation.')
