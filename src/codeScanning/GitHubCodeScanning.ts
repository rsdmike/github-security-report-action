import { type Octokit } from '@octokit/rest'
import { type CodeScanningListAlertsForRepoResponseData, type Endpoints } from '@octokit/types'

import CodeScanningAlert, { type CodeScanningData } from './CodeScanningAlert'
import CodeScanningResults from './CodeScanningResults'

type listCodeScanningAlertsParameters = Endpoints['GET /repos/:owner/:repo/code-scanning/alerts']['parameters']

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

async function getCodeScanning (octokit: Octokit,
  repo: Repo,
  state: 'open' | 'fixed' | 'dismissed'): Promise<CodeScanningResults> {
  const params: listCodeScanningAlertsParameters = {
    owner: repo.owner,
    repo: repo.repo,
    state
  }

  return await octokit.paginate('GET /repos/:owner/:repo/code-scanning/alerts', params)
    // @ts-expect-error -- unknown why to expect error
    .then((alerts: CodeScanningListAlertsForRepoResponseData) => {
      const results: CodeScanningResults = new CodeScanningResults()

      alerts.forEach((alert: CodeScanningData) => {
        results.addCodeScanningAlert(new CodeScanningAlert(alert))
      })

      return results
    })
}
