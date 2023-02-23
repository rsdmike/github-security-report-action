import * as os from 'os'

import puppeteer from 'puppeteer-core'

export async function createPDF (html: string, file: string): Promise<string> {
  const fetcher = puppeteer.createBrowserFetcher({ path: os.tmpdir() })

  return fetcher.download('782078')// TODO need to store and inject this
    .then(revisionInfo => puppeteer.launch({
      executablePath: revisionInfo.executablePath,
      headless: true,
      devtools: true,
      args: [
        '--ignore-certificate-errors',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    })
      .then(browser => browser.newPage()
        .then(page => page.setContent(html)
          .then(() => page.pdf({ path: file, format: 'A4' })))
        .then(() => browser.close()))
      .then(() => file))
}
