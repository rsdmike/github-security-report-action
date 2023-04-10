/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import { launch } from 'puppeteer-core'

export async function createPDF (html: string, file: string): Promise<string> {
  try {
    const browser = await launch({
      channel: 'chrome',
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
    const page = await browser.newPage()
    await page.setContent(html)
    await page.pdf({ path: file, format: 'A4' })
    await browser.close()
  } catch (err) {
    console.error(err)
  }

  return file
}
