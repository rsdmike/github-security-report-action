import { expect } from 'chai'
import { mkdirP } from '@actions/io'
import { createPDF } from './pdfWriter'
import { getTestDirectoryFilePath } from '../testUtils'

describe('pdfWriter', function () {
  this.timeout(30 * 1000)

  it('should generate a simple pdf', async () => {
    const html = '<html><body><h1>Hello World</h1></body>'
    const file = getTestDirectoryFilePath('test.pdf')

    // Ensure the directory exists
    await mkdirP(getTestDirectoryFilePath())

    const generatePdf = await createPDF(html, file)
    expect(generatePdf).to.equal(file)
    // TODO check size
  })
})
