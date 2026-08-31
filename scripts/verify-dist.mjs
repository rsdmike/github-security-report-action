/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
// Smoke test for the packaged action bundle.
//
// The unit tests run against lib/ with a real node_modules tree, so they
// cannot catch a packaging failure. A dependency that resolves a file at
// runtime - e.g. createRequire(import.meta.url)('../data/foo.json') - is
// not traced by ncc, producing a dist/index.js that throws on load while
// every test still passes. The same goes for the templates: they are data
// files ncc does not bundle, and a stale copy in dist/ still renders until
// a template starts using something the source has moved on from.
//
// So this checks three things against the real bundle: the templates in
// dist/ match the sources, they still compile against the runtime's
// nunjucks environment, and the bundle itself gets as far as its own input
// validation rather than dying in the loader.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import nunjucks from 'nunjucks'

const ROOT = path.join(import.meta.dirname, '..')
const BUNDLE = path.join(ROOT, 'dist', 'index.js')
const SOURCE_TEMPLATES = path.join(ROOT, 'templates')
const BUNDLED_TEMPLATES = path.join(ROOT, 'dist', 'templates')
const TIMEOUT_MS = 60_000

// Legacy templates that have never compiled - executive_summary.html has a
// broken commented-out block and summary_old.html still contains handlebars
// syntax. Neither is reachable from the action's `template` input.
const KNOWN_BROKEN_TEMPLATES = new Set(['executive_summary.html', 'summary_old.html'])

function fail (message, detail) {
  console.error(`FAIL: ${message}`)
  if (detail) {
    console.error(`\n${detail}`)
  }
  process.exit(1)
}

function listTemplates (directory) {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [path.relative(directory, full)]
  })

  return walk(directory).map(file => file.split(path.sep).join('/')).sort()
}

if (!fs.existsSync(BUNDLE)) {
  fail(`no bundle found at ${BUNDLE} - run "npm run package" first.`)
}

if (!fs.existsSync(BUNDLED_TEMPLATES)) {
  fail('dist/templates is missing - "npm run package" did not copy the templates.')
}

// The templates are copied, not bundled, so nothing else notices when dist/
// drifts from the sources.
const sourceFiles = listTemplates(SOURCE_TEMPLATES)
const bundledFiles = listTemplates(BUNDLED_TEMPLATES)

const missing = sourceFiles.filter(file => !bundledFiles.includes(file))
const extra = bundledFiles.filter(file => !sourceFiles.includes(file))
const modified = sourceFiles.filter(file =>
  bundledFiles.includes(file) &&
  !fs.readFileSync(path.join(SOURCE_TEMPLATES, file)).equals(fs.readFileSync(path.join(BUNDLED_TEMPLATES, file)))
)

if (missing.length > 0 || extra.length > 0 || modified.length > 0) {
  fail('dist/templates is out of sync with templates/ - run "npm run package".', [
    ...missing.map(file => `  missing from dist: ${file}`),
    ...extra.map(file => `  not in templates/:  ${file}`),
    ...modified.map(file => `  stale in dist:     ${file}`)
  ].join('\n'))
}

// A template referencing a tag or extension the action no longer registers
// only blows up when that template is rendered, which the unit tests never do.
const environment = nunjucks.configure(BUNDLED_TEMPLATES, { autoescape: false })
const compileFailures = bundledFiles
  .filter(file => file.endsWith('.html') && !KNOWN_BROKEN_TEMPLATES.has(file))
  .flatMap(file => {
    try {
      environment.getTemplate(file, true)
      return []
    } catch (err) {
      return [`  ${file}: ${err.message.split('\n').map(line => line.trim()).filter(Boolean).join(' ')}`]
    }
  })

if (compileFailures.length > 0) {
  fail('dist/templates contains templates that do not compile.', compileFailures.join('\n'))
}

// Strip any INPUT_* variables so the action sees genuinely absent inputs
// and reports the missing token itself.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('INPUT_'))
)

const result = spawnSync(process.execPath, [BUNDLE], { encoding: 'utf8', env, timeout: TIMEOUT_MS })
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

// spawnSync reports a failure to start, and a timeout kill, through error -
// stdout and stderr are null in both cases.
if (result.error) {
  const timedOut = result.error.code === 'ETIMEDOUT'
  fail(
    timedOut
      ? `dist/index.js did not exit within ${TIMEOUT_MS}ms - the bundle may be hanging on load.`
      : `could not run dist/index.js: ${result.error.message}`,
    output || undefined
  )
}

if (result.status === null) {
  fail(`dist/index.js was killed by ${result.signal}.`, output || undefined)
}

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
  fail(
    `dist/index.js failed to load (${loaderFailure}).`,
    `This usually means a dependency was not bundled by ncc.\n\n${output}`
  )
}

// The action calls core.setFailed() for the missing token, so a non-zero
// exit is expected here. Reaching this message proves every import in the
// bundle resolved and the action's own code ran.
if (!output.includes('Input required and not supplied')) {
  fail('dist/index.js did not reach input validation.', output || '(no output)')
}

console.log(`OK: dist/index.js loads and reaches input validation, and ${bundledFiles.length} bundled templates match the sources.`)
