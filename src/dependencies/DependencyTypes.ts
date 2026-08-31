/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
export const QUERY_SECURITY_VULNERABILITIES = `
query users($organizationName: String!, $repositoryName: String!, $cursor: String) {

  repository(owner: $organizationName, name: $repositoryName) {
    vulnerabilityAlerts(first: 100, after: $cursor) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        createdAt
        state
        dismisser {
          login
          name
        }
        dismissedAt
        dismissReason
        vulnerableManifestFilename
        vulnerableRequirements
        vulnerableManifestPath
        securityVulnerability{
          package {
            ecosystem
            name
          }
          severity
          vulnerableVersionRange
        }
        securityAdvisory{
          databaseId
          id
          summary
          severity
          description
          ghsaId
          identifiers {
            type
            value
          }
          permalink
          publishedAt
        }
      }
    }
  }
}
`

export interface RepositoryVulnerabilityAlerts {
  repository: {
    vulnerabilityAlerts: {
      totalCount: number
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
      nodes: VulnerabilityAlert[]
    }
  }
}

export interface VulnerabilityAlert {
  id: string
  createdAt: string
  dismisser: {
    login: string
    name: string
  }
  state: string
  dismissedAt: string
  dismissReason: string
  vulnerableManifestFilename: string
  vulnerableRequirements: string
  vulnerableManifestPath
  securityVulnerability: SecurityVulnerability
  securityAdvisory: SecurityAdvisory
}

export interface SecurityVulnerability {
  package: {
    ecosystem: string
    name: string
  }
  severity: string
  vulnerableVersionRange: string
}

export interface SecurityAdvisory {
  databaseId: string
  id: string
  summary: string
  severity: string
  description: string
  ghsaId: string
  identifiers: {
    type: string
    value: string
  }
  permalink: string
  publishedAt: string
}

// NOTE: This query deliberately does NOT request the nested `dependencies` connection
// (nor `dependenciesCount`, which GitHub only resolves as a side effect of it).
// Resolving that connection forces GitHub to expand every manifest's dependency graph,
// which exceeds the server-side GraphQL budget on repositories with a large lockfile and
// fails the whole query with `{"errors":[{"message":"timedout"}]}`. The actual dependency
// list is retrieved from the dependency-graph SBOM REST endpoint instead.
export const QUERY_DEPENDENCY_GRAPH = `
query ($organizationName: String!, $repositoryName: String!, $cursor: String){
  repository(owner: $organizationName name: $repositoryName) {
    name
    dependencyGraphManifests(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
      edges {
        node {
          filename
          blobPath
          exceedsMaxSize
          parseable
        }
      }
    }
  }
}
`

export interface DependencyGraphResult {
  repository: {
    name: string
    dependencyGraphManifests: {
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
      totalCount: number
      edges: DependencySetData[]
    }
  }
}

export interface DependencySetData {
  node: {
    filename: string
    blobPath: string
    exceedsMaxSize: boolean
    parseable: boolean
  }
}

export interface DependencySetDependencyData {
  node: {
    packageName: string
    packageManager: string
    requirements: string
  }
}

/**
 * Minimal SPDX shape of the GitHub dependency-graph SBOM REST response.
 *
 * The asynchronous fetch-report endpoint returns the SPDX document directly, while the
 * deprecated synchronous endpoint nests it under `sbom`; both are accepted.
 */
export interface SbomResponse {
  sbom?: {
    packages?: SbomPackage[]
  }
  packages?: SbomPackage[]
}

export interface SbomPackage {
  name: string
  SPDXID?: string
  versionInfo?: string
  externalRefs?: Array<{
    referenceCategory?: string
    referenceType?: string
    referenceLocator?: string
  }>
}
