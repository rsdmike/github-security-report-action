/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { type Octokit } from '@octokit/rest'
import { type Endpoints } from '@octokit/types'

import CodeScanningAlert, { type CodeScanningData } from './CodeScanningAlert'
import CodeScanningResults from './CodeScanningResults'

type listCodeScanningAlertsParameters = Endpoints['GET /repos/{owner}/{repo}/code-scanning/alerts']['parameters']

interface Repo {
  owner: string
  repo: string
}

export default class GitHubCodeScanning {
  private readonly octokit: Octokit

  constructor (octokit) {
    this.octokit = octokit
  }

  async getOpenCodeScanningAlerts (repo: Repo): Promise<CodeScanningResults> {
    return await getCodeScanning(this.octokit, repo, 'open')
  }

  async getClosedCodeScanningAlerts (repo: Repo): Promise<CodeScanningResults> {
    return await getCodeScanning(this.octokit, repo, 'dismissed')
  }
}

async function getCodeScanning (octokit: Octokit, repo: Repo, state: 'open' | 'fixed' | 'dismissed'): Promise<CodeScanningResults> {
  const params: listCodeScanningAlertsParameters = {
    owner: repo.owner,
    repo: repo.repo,
    // ref: 'refs/pull/1377/merge', for testing
    state
  }

  const alerts: CodeScanningData[] = await octokit.paginate('GET /repos/{owner}/{repo}/code-scanning/alerts' as string, params)
  const results: CodeScanningResults = new CodeScanningResults()

  alerts.forEach((alert: CodeScanningData) => {
    results.addCodeScanningAlert(new CodeScanningAlert(alert))
  })

  return results
}
