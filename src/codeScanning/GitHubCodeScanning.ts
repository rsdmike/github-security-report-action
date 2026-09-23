/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import type { Octokit } from '@octokit/rest'
import type { Endpoints } from '@octokit/types'

import CodeScanningAlert, { type CodeScanningData } from './CodeScanningAlert.ts'
import CodeScanningResults from './CodeScanningResults.ts'

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
    return await getCodeScanning(this.octokit, repo, ['open'])
  }

  async getClosedCodeScanningAlerts (repo: Repo): Promise<CodeScanningResults> {
    return await getCodeScanning(this.octokit, repo, ['dismissed', 'fixed'])
  }
}

type AlertState = 'open' | 'fixed' | 'dismissed'

// The alerts API filters on a single state, so each state is fetched separately and combined.
async function getCodeScanning (octokit: Octokit, repo: Repo, states: AlertState[]): Promise<CodeScanningResults> {
  const results: CodeScanningResults = new CodeScanningResults()

  for (const state of states) {
    const params: listCodeScanningAlertsParameters = {
      owner: repo.owner,
      repo: repo.repo,
      // ref: 'refs/pull/1377/merge', for testing
      state
    }

    const alerts: CodeScanningData[] = await octokit.paginate('GET /repos/{owner}/{repo}/code-scanning/alerts' as string, params)

    alerts.forEach((alert: CodeScanningData) => {
      results.addCodeScanningAlert(new CodeScanningAlert(alert))
    })
  }

  return results
}
