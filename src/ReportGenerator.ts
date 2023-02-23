import { type Octokit } from '@octokit/rest'
import DataCollector from './DataCollector'
import Template from './templating/Template'
import { createPDF } from './pdf/pdfWriter'
import * as path from 'path'

import { mkdirP } from '@actions/io'

export interface ReportGeneratorConfig {
  repository: string
  octokit: Octokit

  sarifReportDirectory: string
  outputDirectory: string

  templating: {
    directory?: string
    name: string
  }
}

export default class ReportGenerator {
  private readonly config: ReportGeneratorConfig

  constructor (config: ReportGeneratorConfig) {
    this.config = config
  }

  async run (): Promise<string> {
    const config = this.config
    const collector = new DataCollector(config.octokit, config.repository)

    return await collector.getPayload(config.sarifReportDirectory)
      .then(reportData => {
        const reportTemplate = new Template(config.templating.directory)
        return reportTemplate.render(reportData.getJSONPayload(), config.templating.name)
      })
      .then(async html => await mkdirP(config.outputDirectory)
        .then(async () => await createPDF(html, path.join(config.outputDirectory, config.templating.name + '.pdf'))))
  }
}
