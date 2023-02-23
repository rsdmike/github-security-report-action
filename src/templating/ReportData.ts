import type Vulnerability from '../dependencies/Vulnerability'
import type DependencySet from '../dependencies/DependencySet'
import { type SarifFile } from '../sarif/SarifReportFinder'
import type CodeScanningResults from '../codeScanning/CodeScanningResults'
import type CodeScanningRule from '../sarif/CodeScanningRule'
import {
  type AlertSummary, type AggregatedAlertSummary,
  type CodeScanningRules, type CodeScanResults, type CodeScanSummary,
  type CollectedData,
  type CWECoverage, type Dependencies,
  type DependencySummary,
  type JsonPayload, type Manifest,
  type Repo,
  type RuleData, type ServerityToVulnerabilities, type SeverityToAlertSummary, type SeverityToAggregatedAlertSummary
} from './ReportTypes'

export default class ReportData {
  private readonly data: CollectedData

  constructor (data: CollectedData) {
    this.data = data || {}
  }

  get githubRepo (): Repo {
    return this.data.github || {}
  }

  get vulnerabilities (): Vulnerability[] {
    return this.data.vulnerabilities || []
  }

  get dependencies (): DependencySet[] {
    return this.data.dependencies || []
  }

  get openDependencyVulnerabilities (): Vulnerability[] {
    return this.vulnerabilities.filter(vuln => !vuln.isDismissed)
  }

  get closedDependencyVulnerabilities (): Vulnerability[] {
    return this.vulnerabilities.filter(vuln => vuln.isDismissed)
  }

  get openCodeScanResults (): CodeScanningResults {
    return this.data.codeScanningOpen || {}
  }

  get closedCodeScanResults (): CodeScanningResults {
    return this.data.codeScanningClosed || {}
  }

  get sarifReports (): SarifFile[] {
    return this.data.sarifReports || []
  }

  get codeScanningRules (): CodeScanningRules {
    const result = {}

    this.sarifReports.forEach(report => {
      // Each report is an object of {file, payload} keys
      const rules = report.payload.rules

      if (rules && rules.length > 0) {
        rules.forEach(rule => {
          result[rule.id] = rule
        })
      }
    })

    return result
  }

  getJSONPayload (): JsonPayload {
    const data = {
      github: this.githubRepo,
      metadata: {
        created: new Date().toISOString()
      },
      sca: {
        dependencies: this.getDependencySummary(),
        vulnerabilities: {
          total: this.openDependencyVulnerabilities.length,
          bySeverity: this.getVulnerabilitiesBySeverity()
        }
      },
      scanning: {
        rules: this.getAppliedCodeScanningRules(),
        cwe: this.getCWECoverage() || {},
        results: this.getCodeScanSummary()
      }
    }
    return data
  }

  getCWECoverage (): CWECoverage | null {
    const rules = this.getAppliedCodeScanningRules()

    if (rules) {
      const result: Record<string, RuleData[]> = {}

      rules.forEach(rule => {
        const cwes = rule.cwe

        if (cwes) {
          cwes.forEach(cwe => {
            if (!result[cwe]) {
              result[cwe] = []
            }

            result[cwe].push(rule)
          })
        }
      })

      return {
        cweToRules: result,
        cwes: Object.keys(result)
      }
    }

    return null
  }

  getDependencySummary (): DependencySummary {
    const unprocessed: Manifest[] = []
    const processed: Manifest[] = []
    const dependencies: Dependencies = {}

    let totalDeps = 0

    this.dependencies.forEach(depSet => {
      totalDeps += depSet.count

      const manifest = {
        filename: depSet.filename,
        path: depSet.path
      }

      if (depSet.isValid) {
        processed.push(manifest)
      } else {
        unprocessed.push(manifest)
      }

      const identifiedDeps = depSet.dependencies
      if (identifiedDeps) {
        identifiedDeps.forEach(dep => {
          const type = dep.packageType.toLowerCase()

          if (!dependencies[type]) {
            dependencies[type] = []
          }

          dependencies[type].push({
            name: dep.name,
            type: dep.packageType,
            version: dep.version
          })
        })
      }
    })

    return {
      manifests: {
        processed,
        unprocessed
      },
      totalDependencies: totalDeps,
      dependencies
    }
  }

  getVulnerabilitiesBySeverity (): ServerityToVulnerabilities {
    const result = {}

    // Obtain third party artifacts ranked by severity
    const vulnerabilities = this.openDependencyVulnerabilities
    vulnerabilities.forEach(vulnerability => {
      const severity = vulnerability.severity.toLowerCase()

      if (!result[severity]) {
        result[severity] = []
      }
      result[severity].push(vulnerability)
    })

    return result
  }

  getAppliedCodeScanningRules (): RuleData[] {
    const rules = this.codeScanningRules

    if (rules) {
      return Object.values(rules).map(rule => getRuleData(rule))
    }

    return []
  }

  getCodeScanSummary (): CodeScanSummary {
    const open = this.openCodeScanResults
    const closed = this.closedCodeScanResults
    const rules = this.codeScanningRules

    const data = {
      open: generateAlertSummary(open, rules),
      closed: generateAlertSummary(closed, rules)
    }

    return data
  }
}

function generateAggregatedAlertSummary (severityToAlertSummary: SeverityToAlertSummary): SeverityToAggregatedAlertSummary {
  const result: SeverityToAggregatedAlertSummary = {}

  Object.entries(severityToAlertSummary).forEach((entry) => {
    const [severity, summaries] = entry
    if (!result[severity]) {
      result[severity] = []
    }

    summaries.forEach((summary) => {
      const existingSummary = result[severity].find((candidate) => candidate.rule.id === summary.rule.id && candidate.state === summary.state)

      if (!existingSummary) {
        const newSummary: AggregatedAlertSummary = {
          tool: summary.tool,
          name: summary.name,
          state: summary.state,
          created: summary.created,
          instances: [
            summary
          ],
          rule: summary.rule
        }

        result[severity].push(newSummary)
      } else {
        existingSummary.instances.push(summary)
      }
    })
  })

  return result
}

function generateAlertSummary (open: CodeScanningResults, rules: CodeScanningRules): CodeScanResults {
  const result: SeverityToAlertSummary = {}
  let total = 0

  open.getCodeQLScanningAlerts().forEach(codeScanAlert => {
    const severity = codeScanAlert.severity
    const matchedRule = rules ? rules[codeScanAlert.ruleId] : null

    const summary: AlertSummary = {
      tool: codeScanAlert.toolName,
      name: codeScanAlert.ruleDescription,
      state: codeScanAlert.state,
      created: codeScanAlert.created,
      url: codeScanAlert.url,
      rule: {
        id: codeScanAlert.ruleId
      }
    }

    if (matchedRule) {
      summary.rule.details = matchedRule
    }

    if (!result[severity]) {
      result[severity] = []
    }
    result[severity].push(summary)
    total++
  })

  return {
    total,
    scans: result,
    scansByRule: generateAggregatedAlertSummary(result)
  }
}

function getRuleData (rule: CodeScanningRule): RuleData {
  return {
    name: rule.name,
    // TODO maybe id?
    severity: rule.severity,
    precision: rule.precision,
    kind: rule.kind,
    shortDescription: rule.shortDescription,
    description: rule.description,
    tags: rule.tags,
    cwe: rule.cwes
  }
}

// TODO this was not used
// function getVulnerability(vuln) {
//   if (!vuln) {
//     return null;
//   }
//
//   const data = {
//     created: vuln.created,
//     published: vuln.publishedAt,
//     severity: vuln.severity,
//     vulnerability: vuln.vulnerability,
//     advisory: vuln.advisory,
//     source: vuln.source,
//     link: vuln.link,
//   };
//
//   if (vuln.isDismissed()) {
//     data.dismissed = vuln.dismissedBy;
//   }
//
//   return data;
// }
