/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { expect } from 'chai'
import * as sinon from 'sinon'
import { Octokit } from '@octokit/rest'
import GitHubDependencies from './GitHubDependencies.ts'
import { QUERY_DEPENDENCY_GRAPH } from './DependencyTypes.ts'

import type DependencySet from './DependencySet.ts'
import type Dependency from './Dependency.ts'
import { getOctoKit } from '../testUtils.ts'

const mockedOctoKit = getOctoKit()

describe('GitHubDependencies', function () {
  this.timeout(10 * 1000)

  const testRepo = {
    owner: 'octodemo',
    repo: 'demo-vulnerabilities-ghas'
  }

  let ghDeps: GitHubDependencies

  before(() => {
    const octokit = mockedOctoKit
    ghDeps = new GitHubDependencies(octokit)
  })

  describe('#getAllDependencies()', () => {
    it(`from ${JSON.stringify(testRepo)}`, async () => {
      const results: DependencySet[] = await ghDeps.getAllDependencies(testRepo)

      expect(results).to.have.length.greaterThan(0)
      expect(results[0]).to.have.property('filename')
      expect(results[0]).to.have.property('isValid').to.equal(true)
    })

    it('does not request the nested dependencies connection', () => {
      // Expanding `dependencyGraphManifests.dependencies` makes GitHub resolve every
      // manifest's full graph, which times out server-side on large lockfiles and fails
      // the entire query. Guard against it being reintroduced.
      expect(QUERY_DEPENDENCY_GRAPH).to.not.match(/\bdependencies\s*(\(|\{)/)
      expect(QUERY_DEPENDENCY_GRAPH).to.not.contain('dependenciesCount')
    })
  })

  describe('#getSbomDependencies()', () => {
    it(`from ${JSON.stringify(testRepo)}`, async () => {
      const results: Dependency[] = await ghDeps.getSbomDependencies(testRepo, { pollIntervalMs: 1 })

      expect(results).to.have.length(4)

      const struts = results.find(dep => dep.name === 'org.apache.struts:struts2-core')
      expect(struts).to.not.equal(undefined)
      expect(struts?.packageType).to.equal('maven')
      expect(struts?.version).to.equal('2.5.20')
    })

    it('derives the package manager from the purl', async () => {
      const results: Dependency[] = await ghDeps.getSbomDependencies(testRepo, { pollIntervalMs: 1 })

      expect(results.find(dep => dep.name === 'lru-cache')?.packageType).to.equal('npm')
    })

    it('falls back to "unknown" for a package with no purl', async () => {
      const results: Dependency[] = await ghDeps.getSbomDependencies(testRepo, { pollIntervalMs: 1 })

      expect(results.find(dep => dep.name === 'mystery-package')?.packageType).to.equal('unknown')
    })

    it('gives up rather than polling forever when the report never completes', async () => {
      const alwaysPending = new Octokit({ auth: 'TOKEN' })
      sinon.stub(alwaysPending, 'request').callsFake(async (route) => {
        if (String(route).includes('generate-report')) {
          return { status: 201, data: { sbom_url: 'https://api.github.com/repos/o/r/dependency-graph/sbom/fetch-report/uuid' } } as any
        }
        return { status: 202, data: undefined } as any
      })

      const deps = new GitHubDependencies(alwaysPending)

      let raised: Error | null = null
      try {
        await deps.getSbomDependencies(testRepo, { timeoutMs: 30, pollIntervalMs: 5 })
      } catch (err: any) {
        raised = err
      }

      expect(raised).to.not.equal(null)
      expect(raised?.message).to.contain('Timed out')
    })

    it('falls back to the synchronous endpoint when generate-report is unavailable', async () => {
      const noAsyncEndpoint = new Octokit({ auth: 'TOKEN' })
      sinon.stub(noAsyncEndpoint, 'request').callsFake(async (route) => {
        if (String(route).includes('generate-report')) {
          const err: any = new Error('Not Found')
          err.status = 404
          throw err
        }
        // The synchronous endpoint nests the document under `sbom`.
        return { status: 200, data: { sbom: { packages: [{ name: 'left-pad', versionInfo: '1.3.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:npm/left-pad@1.3.0' }] }] } } } as any
      })

      const results = await new GitHubDependencies(noAsyncEndpoint).getSbomDependencies(testRepo)

      expect(results).to.have.length(1)
      expect(results[0].name).to.equal('left-pad')
      expect(results[0].packageType).to.equal('npm')
    })

    it('parses the SBOM when the redirect target returns it as an unparsed string', async () => {
      // The completed report is served from a redirect target that does not always send a
      // JSON content type, so Octokit hands back the raw body. Silently treating that as
      // "no dependencies" previously reported a dependency count of 0.
      const stringBody = new Octokit({ auth: 'TOKEN' })
      sinon.stub(stringBody, 'request').callsFake(async (route) => {
        if (String(route).includes('generate-report')) {
          return { status: 201, data: { sbom_url: 'https://api.github.com/repos/o/r/dependency-graph/sbom/fetch-report/uuid' } } as any
        }
        return {
          status: 200,
          data: JSON.stringify({
            packages: [
              { name: 'left-pad', versionInfo: '1.3.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:npm/left-pad@1.3.0' }] }
            ]
          })
        } as any
      })

      const results = await new GitHubDependencies(stringBody).getSbomDependencies(testRepo)

      expect(results).to.have.length(1)
      expect(results[0].name).to.equal('left-pad')
    })

    it('raises rather than reporting zero dependencies when the SBOM has no package list', async () => {
      const emptyBody = new Octokit({ auth: 'TOKEN' })
      sinon.stub(emptyBody, 'request').callsFake(async (route) => {
        if (String(route).includes('generate-report')) {
          return { status: 201, data: { sbom_url: 'https://api.github.com/repos/o/r/dependency-graph/sbom/fetch-report/uuid' } } as any
        }
        return { status: 200, data: {} } as any
      })

      let raised: Error | null = null
      try {
        await new GitHubDependencies(emptyBody).getSbomDependencies(testRepo)
      } catch (err: any) {
        raised = err
      }

      expect(raised).to.not.equal(null)
      expect(raised?.message).to.contain('no package list')
    })

    it('raises when generate-report returns an sbom_url it cannot read a report id from', async () => {
      const badUrl = new Octokit({ auth: 'TOKEN' })
      sinon.stub(badUrl, 'request').callsFake(async (route) => {
        if (String(route).includes('generate-report')) {
          return { status: 201, data: { sbom_url: 'https://example.invalid/nope' } } as any
        }
        throw new Error('should not have polled')
      })

      let raised: Error | null = null
      try {
        await new GitHubDependencies(badUrl).getSbomDependencies(testRepo)
      } catch (err: any) {
        raised = err
      }

      expect(raised).to.not.equal(null)
      expect(raised?.message).to.contain('Could not read a report id')
    })

    it('excludes the repository self-package', async () => {
      const results: Dependency[] = await ghDeps.getSbomDependencies(testRepo, { pollIntervalMs: 1 })

      expect(results.map(dep => dep.name)).to.not.contain('octodemo/demo-vulnerabilities-ghas')
      expect(results.every(dep => dep.packageType !== 'github')).to.equal(true)
    })
  })

  describe('#getAllVulnerabilities()', () => {
    it(`from ${JSON.stringify(testRepo)}`, async () => {
      const results = await ghDeps.getAllVulnerabilities(testRepo)

      expect(results).to.have.length.greaterThan(10)
    })
  })
})
