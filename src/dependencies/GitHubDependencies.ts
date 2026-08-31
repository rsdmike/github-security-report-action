/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import type { Octokit } from '@octokit/rest'
import type { RequestHeaders, RequestParameters } from '@octokit/types'

import {
  QUERY_SECURITY_VULNERABILITIES,
  QUERY_DEPENDENCY_GRAPH,
  type VulnerabilityAlert,
  type DependencySetData, type RepositoryVulnerabilityAlerts, type DependencyGraphResult,
  type SbomResponse
} from './DependencyTypes.ts'

import Vulnerability from './Vulnerability.ts'
import Dependency, { isRepositorySelfPackage } from './Dependency.ts'
import DependencySet from './DependencySet.ts'

interface Repo {
  owner: string
  repo: string
}

export interface SbomPollOptions {
  timeoutMs?: number
  pollIntervalMs?: number
}

const DEFAULT_SBOM_TIMEOUT_MS = 60_000
const DEFAULT_SBOM_POLL_INTERVAL_MS = 2_000

async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

const SBOM_UUID_PATTERN = /\/dependency-graph\/sbom\/fetch-report\/([^/?#]+)$/

/**
 * Pulls the report id out of the `sbom_url` handed back by generate-report, so polling
 * can go through Octokit's templated route instead of following the URL verbatim.
 */
function extractSbomUuid (sbomUrl: string, repo: { owner: string, repo: string }): string {
  const matched = sbomUrl ? SBOM_UUID_PATTERN.exec(sbomUrl) : null

  if (!matched) {
    throw new Error(
      `Could not read a report id from the dependency-graph SBOM URL for ${repo.owner}/${repo.repo}: ${String(sbomUrl)}`
    )
  }

  return matched[1]
}

export default class GitHubDependencies {
  private readonly octokit: Octokit

  constructor (octokit) {
    this.octokit = octokit
  }

  async getAllVulnerabilities (repo: Repo): Promise<Vulnerability[]> {
    function extractVulnerabilityAlerts (data: RepositoryVulnerabilityAlerts): VulnerabilityAlert[] {
      return data.repository.vulnerabilityAlerts.nodes
    }

    const data: VulnerabilityAlert[] = await this.getPaginatedQuery<RepositoryVulnerabilityAlerts, VulnerabilityAlert>(
      QUERY_SECURITY_VULNERABILITIES,
      { organizationName: repo.owner, repositoryName: repo.repo },
      'repository.vulnerabilityAlerts.pageInfo',
      extractVulnerabilityAlerts
    )

    return data.map(val => new Vulnerability(val))
  }

  /**
   * Returns metadata for every dependency manifest GitHub has detected for the repository.
   * This does not include the dependencies themselves -- see getSbomDependencies().
   */
  async getAllDependencies (repo: Repo): Promise<DependencySet[]> {
    function extractDependencySetData (data: DependencyGraphResult): DependencySetData[] {
      return data.repository.dependencyGraphManifests.edges
    }

    const data = await this.getPaginatedQuery(
      QUERY_DEPENDENCY_GRAPH,
      { organizationName: repo.owner, repositoryName: repo.repo },
      'repository.dependencyGraphManifests.pageInfo',
      extractDependencySetData,
      { accept: 'application/vnd.github.hawkgirl-preview+json' }
    )

    return data.map(node => new DependencySet(node))
  }

  /**
   * Returns the repository's resolved dependencies from its dependency-graph SBOM.
   *
   * Uses the asynchronous SBOM API: request a report, then poll until GitHub has built
   * it. This replaces expanding `dependencyGraphManifests.dependencies` over GraphQL,
   * which exceeds GitHub's server-side query budget on repositories with a large
   * lockfile and fails with `timedout`.
   *
   * Falls back to the synchronous endpoint when the asynchronous one is unavailable
   * (older GitHub Enterprise Server). That endpoint is deprecated on github.com and is
   * scheduled for removal on 2026-11-13.
   */
  async getSbomDependencies (repo: Repo, options: SbomPollOptions = {}): Promise<Dependency[]> {
    const document = await this.fetchSbomDocument(repo, options)

    // The asynchronous endpoint returns the SPDX document directly; the synchronous one
    // nests it under `sbom`.
    const packages = document?.sbom?.packages ?? document?.packages

    if (!packages) {
      throw new Error(
        `The dependency-graph SBOM for ${repo.owner}/${repo.repo} contained no package list`
      )
    }

    return packages
      .filter(pkg => !isRepositorySelfPackage(pkg))
      .map(pkg => Dependency.fromSbomPackage(pkg))
  }

  /**
   * The completed SBOM is served from a redirect target that does not always carry a JSON
   * content type, in which case Octokit hands back the raw body as a string.
   */
  private parseSbomBody (data: unknown, repo: Repo): SbomResponse {
    if (typeof data !== 'string') {
      return data as SbomResponse
    }

    try {
      return JSON.parse(data) as SbomResponse
    } catch (err: any) {
      throw new Error(
        `Could not parse the dependency-graph SBOM for ${repo.owner}/${repo.repo}: ${err.message as string}`
      )
    }
  }

  private async fetchSbomDocument (repo: Repo, options: SbomPollOptions): Promise<SbomResponse> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_SBOM_TIMEOUT_MS
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_SBOM_POLL_INTERVAL_MS
    const deadline = Date.now() + timeoutMs

    let sbomUuid: string
    try {
      const generated = await this.octokit.request(
        'GET /repos/{owner}/{repo}/dependency-graph/sbom/generate-report',
        { owner: repo.owner, repo: repo.repo }
      )
      sbomUuid = extractSbomUuid((generated.data as { sbom_url: string }).sbom_url, repo)
    } catch (err: any) {
      if (err?.status === 404) {
        return await this.fetchSbomDocumentSynchronously(repo)
      }
      throw err
    }

    while (true) {
      // Polled through the templated route rather than by following `sbom_url` verbatim,
      // so the request stays on the configured GitHub API host and the credential is
      // never sent to whatever host the response happens to name.
      const response = await this.octokit.request(
        'GET /repos/{owner}/{repo}/dependency-graph/sbom/fetch-report/{sbom_uuid}',
        { owner: repo.owner, repo: repo.repo, sbom_uuid: sbomUuid }
      )

      // 202 means GitHub is still building the report.
      if (response.status !== 202) {
        return this.parseSbomBody(response.data, repo)
      }

      if (Date.now() + pollIntervalMs > deadline) {
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for the dependency-graph SBOM of ${repo.owner}/${repo.repo} to be generated`
        )
      }

      await delay(pollIntervalMs)
    }
  }

  private async fetchSbomDocumentSynchronously (repo: Repo): Promise<SbomResponse> {
    const response = await this.octokit.request(
      'GET /repos/{owner}/{repo}/dependency-graph/sbom',
      { owner: repo.owner, repo: repo.repo }
    )
    return this.parseSbomBody(response.data, repo)
  }

  async getPaginatedQuery<T, Y>(query: string, parameters: Record<string, unknown>, pageInfoPath: string, extractResultsFn: (val: T) => Y[], headers?): Promise<Y[]> {
    const octokit = this.octokit
    const results: Y[] = []
    const queryParameters = Object.assign({ cursor: null }, parameters)

    let hasNextPage = false
    do {
      const graphqlParameters = buildGraphQLParameters(query, queryParameters, headers)
      const queryResult = await octokit.graphql(graphqlParameters)

      // @ts-expect-error - unknown why to expect error
      const extracted: Y = extractResultsFn(queryResult)
      // @ts-expect-error - unknown why to expect error
      results.push(...extracted)

      const pageInfo = getObject(queryResult, ...pageInfoPath.split('.'))
      hasNextPage = pageInfo ? pageInfo.hasNextPage as boolean : false
      if (hasNextPage && pageInfo != null) {
        queryParameters.cursor = pageInfo.endCursor as any
      }
    } while (hasNextPage)

    return results
  }
}

function buildGraphQLParameters (query: string, parameters?: Record<string, unknown>, headers?: RequestHeaders): RequestParameters {
  const result: RequestParameters = {
    ...(parameters || {}),
    query
  }

  if (headers) {
    result.headers = headers
  }

  return result
}

function getObject (target, ...path): Record<string, unknown> | null {
  if (target != null) {
    const value = target[path[0]]

    if (path.length > 1) {
      return getObject(value, ...path.slice(1))
    } else {
      return value
    }
  }
  return null
}
