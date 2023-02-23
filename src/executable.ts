import ReportGenerator, { type ReportGeneratorConfig } from './ReportGenerator'
import { Octokit } from '@octokit/rest'

import path from 'path'

import { program } from 'commander'
program.name('github-security-report')
// eslint-disable-next-line @typescript-eslint/no-var-requires
program.version(require('../package.json').version)

program.requiredOption('-t, --token <token>', 'github access token')
program.requiredOption('-r, --repository <repository>', 'github repository, owner/repo_name format')
program.option('-s, --sarif-directory <sarifReportDirectory>', 'the SARIF report directory to load reports from', '../results')
program.option('-o, --output-directory <outputDirectory>', 'output directory for the report', '.')
program.option('--template <template>', 'report template type used to render the report', 'summary')
program.option('--github-api-url <url>', 'GitHub API URL', 'https://api.github.com')

program.parse(process.argv)
const opts = program.opts()

const reportGenerateConfig: ReportGeneratorConfig = {
  repository: opts.repository,
  octokit: new Octokit({ auth: opts.token, baseUrl: opts.url }),
  sarifReportDirectory: getPath(opts.sarifDirectory),
  outputDirectory: getPath(opts.outputDirectory),
  templating: {
    name: opts.template
  }
}

async function execute (reportGenerateConfig: ReportGeneratorConfig): Promise<void> {
  try {
    const generator = new ReportGenerator(reportGenerateConfig)
    console.log(`Generating Security report for ${reportGenerateConfig.repository}...`)
    const file = await generator.run()
    console.log(`Summary Report generated: ${file}`)
  } catch (err: any) {
    console.log(err.stack)
    console.error(err.message)
    console.error()
    program.help({ error: true })
  }
}

void execute(reportGenerateConfig)

function getPath (value): string {
  if (path.isAbsolute(value)) {
    return value
  } else {
    return path.normalize(path.join(process.cwd(), value))
  }
}
