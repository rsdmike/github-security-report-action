import * as fs from 'fs'
import { expect } from 'chai'
import Template from './Template'
import { getSampleReportJsonDirectory, getTestDirectoryFilePath } from '../testUtils'

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
