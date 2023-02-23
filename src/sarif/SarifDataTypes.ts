export interface SarifReportData {
  version: string
  runs: SarifRun[]
}

export interface SarifRun {
  tool: {
    driver: {
      name: string
      rules: SarifRule[]
    }
    extensions?: ToolExtension[]
  }
}

export interface ToolExtension {
  name: string
  rules: SarifRule[]
}

export interface SarifRule {
  id: string
  name: string
  shortDescription: {
    text: string
  }
  fullDescription: {
    text: string
  }
  properties: {
    tags: string[]
    precision: string
    kind: string

  }
  defaultConfiguration: {
    level: string
  }
}
