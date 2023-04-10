/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import ReportGenerator from './ReportGenerator'

import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

async function run (): Promise<void> {
  try {
    const token = getRequiredInputValue('token')

    const generator = new ReportGenerator({
      repository: getRequiredInputValue('repository'),
      octokit: new Octokit({ auth: token }),

      sarifReportDirectory: getRequiredInputValue('sarifReportDir'),
      outputDirectory: getRequiredInputValue('outputDir'),

      templating: {
        directory: './templates',
        name: getRequiredInputValue('template')
      }
    })

    const file = await generator.run()
    console.log(file)
  } catch (err: any) {
    core.setFailed(err.message)
  }
}

void run()

function getRequiredInputValue (key: string): string {
  return core.getInput(key, { required: true })
}
