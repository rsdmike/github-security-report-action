/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import type { DependencySetData } from './DependencyTypes.ts'

/**
 * A dependency manifest detected by GitHub's dependency graph.
 *
 * This carries manifest metadata only. The dependencies themselves are collected
 * separately from the SBOM REST endpoint -- see the note on QUERY_DEPENDENCY_GRAPH.
 */
export default class DependencySet {
  private readonly data: DependencySetData

  constructor (data: DependencySetData) {
    this.data = data
  }

  get filename (): string {
    return this.data.node.filename
  }

  get path (): string {
    return this.data.node.blobPath
  }

  get isValid (): boolean {
    return this.parsable && !this.exceededMaxSize
  }

  get parsable (): boolean {
    return this.data.node.parseable
  }

  get exceededMaxSize (): boolean {
    return this.data.node.exceedsMaxSize
  }
}
