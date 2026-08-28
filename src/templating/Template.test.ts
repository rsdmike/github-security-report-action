/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import * as fs from 'fs'
import { expect } from 'chai'
import Template from './Template.ts'
import { getSampleDataDirectory, getSampleReportJsonDirectory, getTestDirectoryFilePath } from '../testUtils.ts'

const OCTODEMO_GHAS_REPORTING = {
  directory: 'octodemo/ghas-reporting',
  json: 'payload.json',
  expectedSummary: 'summary.html'
}

describe('Template', () => {
  [OCTODEMO_GHAS_REPORTING].forEach(config => {
    it(`should render ${config.directory}`, () => {
      const reporting = new Template()
      const data = readSampleFileAsJson(config.directory, 'payload.json')
      const fileContent = reporting.render(data, 'summary')

      fs.writeFileSync(getTestDirectoryFilePath(config.directory, 'summary.html'), fileContent)

      const expectedContent = getExpectedContents(config)
      expect(fileContent).to.equal(expectedContent)
    })
  })
})

function getExpectedContents (config): string {
  const content = fs.readFileSync(getSampleReportJsonDirectory(config.directory, config.expectedSummary))
  return content.toString('utf-8')
}

function readSampleFileAsJson (subDir, file): any {
  const content = fs.readFileSync(getSampleReportJsonDirectory(...[subDir, file]))
  return JSON.parse(content.toString('utf-8'))
}

describe('Template markdown rendering', () => {
  const markdownTemplates = getSampleDataDirectory('templates')

  it('should convert markdown in a {% markdown %} block into HTML', () => {
    const content = '# Heading\n\nSome **bold** text and a [link](https://example.com).\n\n- item one\n- item two'
    const result = new Template(markdownTemplates).render({ content }, 'markdown_block')

    expect(result).to.contain('<h1>Heading</h1>')
    expect(result).to.contain('<strong>bold</strong>')
    expect(result).to.contain('<a href="https://example.com">link</a>')
    expect(result).to.contain('<li>item one</li>')
    // The raw markdown syntax must not survive into the rendered output
    expect(result).to.not.contain('**bold**')
  })

  it('should sanitize unsafe HTML embedded in markdown', () => {
    const content = 'Before\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\nAfter'
    const result = new Template(markdownTemplates).render({ content }, 'markdown_block')

    expect(result).to.not.contain('<script')
    expect(result).to.not.contain('onerror')
  })
})
