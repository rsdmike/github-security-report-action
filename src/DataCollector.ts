/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { type Octokit } from '@octokit/rest'
import GitHubCodeScanning from './codeScanning/GitHubCodeScanning'
import GitHubDependencies from './dependencies/GitHubDependencies'
import SarifReportFinder from './sarif/SarifReportFinder'
import ReportData from './templating/ReportData'
import { type CollectedData } from './templating/ReportTypes'

interface Repo {
  owner: string
  repo: string
}

export default class DataCollector {
  private readonly repo: Repo

  private readonly octokit

  constructor (octokit: Octokit, repo: string) {
    if (!octokit) {
      throw new Error('A GitHub Octokit client needs to be provided')
    }
    this.octokit = octokit

    if (!repo) {
      throw new Error('A GitHub repository must be provided')
    }

    const parts = repo.split('/')
    this.repo = {
      owner: parts[0],
      repo: parts[1]
    }
  }

  async getPayload (sarifReportDir: string): Promise<ReportData> {
    const ghDeps = new GitHubDependencies(this.octokit)
    const codeScanning = new GitHubCodeScanning(this.octokit)
    const sarifFinder = new SarifReportFinder(sarifReportDir)

    const results = await Promise.all([
      sarifFinder.getSarifFiles(),
      ghDeps.getAllDependencies(this.repo),
      ghDeps.getAllVulnerabilities(this.repo),
      codeScanning.getOpenCodeScanningAlerts(this.repo),
      codeScanning.getClosedCodeScanningAlerts(this.repo)
    ])

    const data: CollectedData = {
      github: this.repo,
      sarifReports: results[0],
      dependencies: results[1],
      vulnerabilities: results[2],
      codeScanningOpen: results[3],
      codeScanningClosed: results[4]
    }

    return new ReportData(data)
  }
}
