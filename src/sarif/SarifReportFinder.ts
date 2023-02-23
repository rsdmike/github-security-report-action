import * as path from 'path'
import * as fs from 'fs'
import SarifReport from './SarifReport'

export interface SarifFile {
  file: string
  payload: SarifReport
}

export default class SarifReportFinder {
  private readonly dir: string

  constructor (dir: string) {
    this.dir = dir
  }

  async getSarifFiles (): Promise<SarifFile[]> {
    const dir = this.dir
    const promises: Array<Promise<SarifFile>> = []

    if (!fs.existsSync(dir)) {
      throw new Error(`SARIF Finder, path "${dir}", does not exist.`)
    }

    console.log(`SARIF File Finder, processing: ${dir}`)
    if (fs.lstatSync(dir).isDirectory()) {
      console.log('  is a directory, looking for files')

      const files = fs.readdirSync(dir) // TODO use promises here
        .filter(f => f.endsWith('.sarif'))
        .map(f => path.resolve(dir, f))

      console.log(`  SARIF files detected: ${JSON.stringify(files)}`)
      if (files) {
        files.forEach(f => {
          promises.push(loadFileContents(f))
        })
      }
    }

    if (promises.length > 0) {
      return await Promise.all(promises)
    } else {
      return await Promise.resolve([])
    }
  }
}

async function loadFileContents (file: string): Promise<SarifFile> {
  return await fs.promises.open(file, 'r')
    .then(async fileHandle => await fileHandle.readFile()
      .then(async content => {
        await fileHandle.close()
        try {
          return JSON.parse(content.toString('utf8'))
        } catch (err) {
          throw new Error(`Failed to parse JSON from SARIF file '${file}': ${err}`)
        }
      })
      .then(data => ({
        file,
        payload: new SarifReport(data)
      })))
}
