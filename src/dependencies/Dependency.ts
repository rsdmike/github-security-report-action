/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import type { SbomPackage } from './DependencyTypes.ts'

/**
 * A single resolved dependency, sourced from the repository's dependency-graph SBOM.
 */
export default class Dependency {
  readonly name: string

  readonly packageType: string

  readonly version: string

  constructor (name: string, packageType: string, version: string) {
    this.name = name
    this.packageType = packageType
    this.version = version
  }

  /**
   * Builds a Dependency from an SPDX package entry.
   *
   * The package manager is taken from the purl external reference
   * (`pkg:npm/lru-cache@11.5.1` -> `npm`), falling back to `unknown` when a package
   * carries no parseable purl.
   */
  static fromSbomPackage (pkg: SbomPackage): Dependency {
    return new Dependency(
      pkg.name,
      getPackageManager(pkg),
      pkg.versionInfo ?? ''
    )
  }
}

const PURL_PATTERN = /^pkg:([^/]+)\//

export function getPackageManager (pkg: SbomPackage): string {
  const purl = pkg.externalRefs?.find(ref => ref.referenceType === 'purl')?.referenceLocator

  const matched = purl ? PURL_PATTERN.exec(purl) : null
  return matched ? matched[1] : 'unknown'
}

/**
 * The SBOM describes the repository itself as a `pkg:github/...` package. It is not a
 * dependency of the repository, so it is excluded from the reported dependency list.
 */
export function isRepositorySelfPackage (pkg: SbomPackage): boolean {
  return getPackageManager(pkg) === 'github'
}
