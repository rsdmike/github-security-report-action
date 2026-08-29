# github-security-report-action

A GitHub Action for generating PDF reports for GitHub Advanced Security Code Scan Results and Dependency Vulnerabilities.

The action comes with some predefined HTML templates using [Nunjucks](https://mozilla.github.io/nunjucks/templating.html),
along with the ability to in the future provide your own templates to the renderer.

Due to the nature of CodeQL Analysis this action ideally should be executed after the `github/codeql-action/analyze`
action step, as this will generate the SARIF files on the runner which can be used to identify ALL the rules that were
applied during the analysis. The results stored on your repository will only contain the results that generated an alert.

## Processing

The action will use the provided token to load all the dependencies, dependency vulnerabilities and the Code Scanning
results for the specified repository. It will then look in the directory specified for any SARIF reports.

With this data it will construct a JSON payload that it then passes into the template system (using Nunjucks a Jinja
like templating system for JavaScript) and will generate a Summary Report (with more of these to come in the future)
providing a roll up summary security report in HTML.

Using this HTML, it then passes it over to Puppeteer to render this in a headless Chromium before generating a PDF and
saving it in the specified directory.

## Parameters

* `token`: A GitHub Personal Access Token with access to `repo` scope
* `sarifReportDir`: The directory to look for SARIF reports (from the CodeQL analyze action this defaults to `../results`)
* `outputDir`: The output directory for the PDF reports, defaults to `github.workspace`
* `repository`: The repository in `<owner>/<repo_name>` form, defaults to `github.repository`
* `template`: The report template type used to render the report, defaults to `summary`


## Templates

Currently there is partial support for templates that are included in the action. Extenders of the action are welcome to author
additional templates by creating HTML templates using [Nunjucks](https://mozilla.github.io/nunjucks/templating.html) inside the `templates` folder.

You can specify a template by using the `template` parameter. Currently the following templates are available:
* `summary`: The classic summary report from previous versions.
* `report`: A more detailed report covering dependencies (Software Composition Analysis) and code
  scanning, ending with each open code scanning alert listed individually under its severity.
* `aggregated_report`: The same content as `report`, except the open code scanning alerts are
  grouped by rule - with an instance count per rule - rather than listed individually.


## Examples

```
name: Generate Security Report
uses: rsdmike/github-security-report-action@v4
with:
  token: ${{ secrets.SECURITY_TOKEN }}
```

Example summary report output:
![Example summary report](summary_report_example.png)



## Command line usage

The report generator can also be run directly from a clone of this repository,
using the same options as the Action.

```
$ npm install
$ npm run build
$ node lib/executable.js --help
```

Options:
* `-t`, `--token`: The GitHub Personal Access Token that has the necessary access for security and dependency API endpoints.
* `-r`, `--repository`: The repository that contains the source code, in `<owner>/<repository_name>` form, e.g. `peter-murray/node-hue-api`
* `-s`, `--sarif-directory`: The directory containing the SARIF report files. Defaults to `../results`.
* `-o`, `--output-directory`: The directory to output the PDF report to. This will be created if it does not exist. Defaults to the current directory.
* `--template`: The report template type used to render the report. This defaults to `summary`.
* `--github-api-url`: The GitHub API URL, for GitHub Enterprise Server. Defaults to `https://api.github.com`.

For example:
```
$ node lib/executable.js -t <GitHub PAT Token> -r peter-murray/node-hue-api -s <directory containing CodeQL SARIF file(s)>
```
The above command would output a `summary.pdf` file in the current working directory.

Requires Node >= 22.12.0.

## Future improvements

* Additional work on the currently available reports
* Example of extending html templates and using them

