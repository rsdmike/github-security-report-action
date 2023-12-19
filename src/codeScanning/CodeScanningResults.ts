/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import type CodeScanningAlert from './CodeScanningAlert'

export default class CodeScanningResults {
  private readonly data: CodeScanningAlert[]

  constructor () {
    this.data = []
  }

  addCodeScanningAlert (alert: CodeScanningAlert): void {
    this.data.push(alert)
  }

  getTools (): string[] {
    const result: string[] = []

    this.data.forEach(alert => {
      const toolName = alert.toolName

      if (toolName && !result.includes(toolName)) {
        result.push(toolName)
      }
    })

    return result
  }

  getCodeQLScanningAlerts (): CodeScanningAlert[] {
    return this.data.filter(value =>
    // TODO this is now reporting CodeQL command-line toolchain as the name of the tool!
    // Need to follow up on this with GHAS team on what to expect in the future.
       `${value.toolName}`.toLowerCase().startsWith('codeql') || `${value.toolName}`.toLowerCase().startsWith('trivy')
    )
  }
}
