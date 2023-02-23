import type CodeScanningRule from '../sarif/CodeScanningRule'
import type Vulnerability from '../dependencies/Vulnerability'
import type DependencySet from '../dependencies/DependencySet'
import { type SarifFile } from '../sarif/SarifReportFinder'
import type CodeScanningResults from '../codeScanning/CodeScanningResults'

export interface RuleData {
  name: string
  severity: string
  precision: string
  kind: string
  shortDescription: string
  description: string
  tags: string[]
  cwe: string[]
}

export interface Repo {
  owner: string
  repo: string
}

export type CodeScanningRules = Record<string, CodeScanningRule>

export interface CollectedData {
  github: Repo
  vulnerabilities: Vulnerability[]
  dependencies: DependencySet[]
  sarifReports: SarifFile[]
  codeScanningOpen: CodeScanningResults
  codeScanningClosed: CodeScanningResults
}

export interface JsonPayload {
  github: Repo
  metadata: {
    created: string
  }
  sca: {
    dependencies: DependencySummary
    vulnerabilities: {
      total: number
      bySeverity: ServerityToVulnerabilities
    }
  }
  scanning: {
    rules: RuleData[]
    cwe: CWECoverage | Record<string, unknown>
    results: CodeScanSummary
  }
}

export interface DependencySummary {
  manifests: {
    processed: Manifest[]
    unprocessed: Manifest[]
  }
  totalDependencies: number
  dependencies: Dependencies
}

export interface Manifest {
  filename: string
  path: string
}

export type Dependencies = Record<string, Dependency[]>

export interface Dependency {
  name: string
  type: string
  version: string
}

export type ServerityToVulnerabilities = Record<string, Vulnerability[]>

export interface AlertSummary {
  tool: string | null
  name: string
  state: string
  created: string
  url: string
  rule: {
    id: string
    details?: CodeScanningRule
  }
}

export type SeverityToAlertSummary = Record<string, AlertSummary[]>

export interface AggregatedAlertSummary {
  tool: string | null
  name: string
  state: string
  created: string
  instances: AlertSummary[]
  rule: {
    id: string
    details?: CodeScanningRule
  }
}

export type SeverityToAggregatedAlertSummary = Record<string, AggregatedAlertSummary[]>

export interface CodeScanResults {
  total: number
  scans: SeverityToAlertSummary
  scansByRule: SeverityToAggregatedAlertSummary
}

export interface CWECoverage {
  cweToRules: Record<string, RuleData[]>
  cwes: string[]
}

export interface CodeScanSummary {
  open: CodeScanResults
  closed: CodeScanResults
}
