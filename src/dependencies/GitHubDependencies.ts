/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { type Octokit } from '@octokit/rest'
import { type RequestHeaders, type RequestParameters } from '@octokit/types'

import {
  QUERY_SECURITY_VULNERABILITIES,
  QUERY_DEPENDENCY_GRAPH,
  type VulnerabilityAlert,
  type DependencySetData, type RepositoryVulnerabilityAlerts, type DependencyGraphResult
} from './DependencyTypes'

import Vulnerability from './Vulnerability'
import DependencySet from './DependencySet'

interface Repo {
  owner: string
  repo: string
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
