/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { expect } from 'chai'
import { mkdirP } from '@actions/io'
import * as fs from 'fs'
import { createPDF } from './pdfWriter.ts'
import { getTestDirectoryFilePath } from '../testUtils.ts'

describe('pdfWriter', function () {
  this.timeout(30 * 1000)

  it('should generate a simple pdf', async () => {
    const html = '<html><body><h1>Hello World</h1></body>'
    const file = getTestDirectoryFilePath('test.pdf')

    // Ensure the directory exists
    await mkdirP(getTestDirectoryFilePath())

    // Clear any artifact from a previous run, so that the assertions below
    // can only pass if this run actually produced the file
    fs.rmSync(file, { force: true })

    const generatePdf = await createPDF(html, file)
    expect(generatePdf).to.equal(file)

    // createPDF swallows any error and returns the path regardless, so the
    // returned value alone proves nothing. Assert against the file itself.
    expect(fs.existsSync(file), `expected ${file} to be created`).to.equal(true)

    const contents = fs.readFileSync(file)
    expect(contents.subarray(0, 5).toString()).to.equal('%PDF-')
    expect(contents.length).to.be.greaterThan(1000)
  })
})
