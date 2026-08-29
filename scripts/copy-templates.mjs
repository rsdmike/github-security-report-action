/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
// Copies the report templates into the packaged bundle.
//
// ncc relocates assets by pattern matching path.join(__dirname, '<literal>')
// in the sources it bundles. It does not recognise import.meta.dirname, so
// now that the action is ESM nothing copies templates/ into dist/ for us -
// and the failure is silent, because ncc never cleans its output directory
// and the previously committed dist/templates/ simply goes stale. Do the
// copy explicitly instead of relying on the relocator.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const SOURCE = path.join(ROOT, 'templates')
const TARGET = path.join(ROOT, 'dist', 'templates')

if (!fs.existsSync(SOURCE)) {
  console.error(`No templates found at ${SOURCE}.`)
  process.exit(1)
}

// Remove first, so templates deleted from source do not linger in the bundle.
fs.rmSync(TARGET, { recursive: true, force: true })
fs.cpSync(SOURCE, TARGET, { recursive: true })

console.log(`Copied templates into ${path.relative(ROOT, TARGET)}`)
