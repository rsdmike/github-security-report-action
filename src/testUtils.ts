/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import * as path from 'path'
import { Octokit } from '@octokit/rest'
import type {
  RequestParameters
} from '@octokit/types'
import * as sinon from 'sinon'
import * as fs from 'fs'
import {
  QUERY_SECURITY_VULNERABILITIES // , QUERY_DEPENDENCY_GRAPH
} from './dependencies/DependencyTypes.ts'

export function getTestDirectoryFilePath (...filePath): string {
  const args = [import.meta.dirname, '..', '_tmp', ...filePath]
  return path.join(...args)
}

export function getSampleDataDirectory (...dir): string {
  const args = [import.meta.dirname, '..', 'samples', ...dir]
  return path.join(...args)
}

export function getSampleSarifDirectory (...dir): string {
  const args = [import.meta.dirname, '..', 'samples', 'sarif', ...dir]
  return path.join(...args)
}

export function getSampleReportJsonDirectory (...dir): string {
  const args = [import.meta.dirname, '..', 'samples', 'reportJson', ...dir]
  return path.join(...args)
}

export function getGitHubToken (): string {
  const token = process.env.GH_TOKEN

  if (!token) {
    throw new Error('GitHub Token was not set for environment variable "GH_TOKEN"')
  }
  return token
}

export function getOctoKit (): Octokit {
  const mockedOctoKit = new Octokit({ auth: 'TOKEN' })

  sinon.stub(mockedOctoKit, 'paginate').callsFake(async (route, params) => {
    const parameters: RequestParameters = typeof params === 'string' ? JSON.parse(params) : params
    const responseFile: string = path.join(import.meta.dirname, '..', 'samples', 'mocks', 'code-scanning', 'alerts', parameters.owner as string, parameters.repo as string, (parameters.state as string) + '.json')

    // Generate response from mock file:
    const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'))
    return await new Promise((resolve, reject) => {
      resolve(response)
    })
  })
  // Models the asynchronous SBOM API: generate-report hands back a poll URL, the first
  // poll reports 202 (still building), and the next returns the SPDX document.
  const sbomPollCounts = new Map<string, number>()

  sinon.stub(mockedOctoKit, 'request').callsFake(async (route, params?) => {
    const parameters: RequestParameters = (params ?? {}) as RequestParameters
    const path_ = String(route)

    if (path_.includes('/dependency-graph/sbom/generate-report')) {
      const slug = `${parameters.owner as string}/${parameters.repo as string}`
      sbomPollCounts.set(slug, 0)
      return { status: 201, data: { sbom_url: `https://api.github.com/repos/${slug}/dependency-graph/sbom/fetch-report/test-uuid` } } as any
    }

    if (path_.includes('/dependency-graph/sbom/fetch-report/')) {
      const matched = /repos\/([^/]+)\/([^/]+)\/dependency-graph/.exec(path_)
      const slug = `${matched?.[1] as string}/${matched?.[2] as string}`

      const attempts = (sbomPollCounts.get(slug) ?? 0) + 1
      sbomPollCounts.set(slug, attempts)

      // First poll: report still being generated. Simulated only for the repo whose
      // tests exercise the polling flow directly (and override the poll interval).
      if (attempts === 1 && matched?.[2] === 'demo-vulnerabilities-ghas') {
        return { status: 202, data: undefined } as any
      }

      const responseFile = path.join(import.meta.dirname, '..', 'samples', 'mocks', 'rest', matched?.[1] as string, matched?.[2] as string, 'sbom.json')
      const document = JSON.parse(fs.readFileSync(responseFile, 'utf8'))
      // The asynchronous endpoint returns the SPDX document without the `sbom` wrapper.
      return { status: 200, data: document.sbom ?? document } as any
    }

    throw new Error(`Unmocked octokit.request route: ${path_}`)
  })

  sinon.stub(mockedOctoKit, 'graphql').callsFake(async (request, query, options?) => {
    const parameters: RequestParameters = typeof request === 'string' ? JSON.parse(request) : request

    const organizationName = parameters.organizationName as string
    const repositoryName = parameters.repositoryName as string
    const isVulnerabilityQuery = parameters.query as string === QUERY_SECURITY_VULNERABILITIES
    // const isDependecyQuery = parameters.query as string === QUERY_DEPENDENCY_GRAPH
    const queryType = isVulnerabilityQuery ? 'vulnerabilities' : 'dependencies'

    const responseFile = path.join(import.meta.dirname, '..', 'samples', 'mocks', 'graphql', organizationName, repositoryName, queryType + '.json')

    // Generate response from mock file:
    const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'))
    return await new Promise((resolve, reject) => {
      resolve(response)
    })
  })

  return mockedOctoKit
}
