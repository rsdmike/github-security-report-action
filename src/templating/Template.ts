/*********************************************************************
 * Copyright (c) Intel Corporation 2023
 **********************************************************************/
import * as fs from 'fs'

import path from 'path'
import { configure, type Environment } from 'nunjucks'
import markdown from 'nunjucks-markdown'
import { marked } from 'marked'
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'
// Default templates as part of the action
const EMBEDDED_TEMPLATES = path.join(__dirname, '..', '..', 'templates')

export default class Template {
  private readonly environment: Environment
  private readonly templatesDir: string

  constructor (templatesDir?: string) {
    if (!templatesDir) {
      this.templatesDir = EMBEDDED_TEMPLATES
    } else {
      this.templatesDir = templatesDir
    }

    marked.setOptions({
      renderer: new marked.Renderer(),
      gfm: true,
      breaks: false,
      pedantic: false
    })

    this.environment = configure(this.templatesDir, { autoescape: false })
    const window = new JSDOM('').window
    const purify = DOMPurify(window)
    markdown.register(this.environment, purify.sanitize(marked.parse))
  }

  render (data, template): string {
    const resolvedTemplateFilename = this.getValidatedTemplateFileName(template)
    const content = this.environment.render(resolvedTemplateFilename, data)
    // TODO consider providing intermediate output
    return content
  }

  getValidatedTemplateFileName (name): string {
    if (fs.existsSync(path.join(this.templatesDir, name))) {
      return name
    } else {
      // Try our known supported extensions
      const found = ['html', 'j2'].filter(extension => fs.existsSync(path.join(this.templatesDir, `${name}.${extension}`)))

      if (found.length > 0) {
        return `${name}.${found[0]}`
      }
    }

    throw new Error(`Failed to resolve a template file from directory ${this.templatesDir} with name "${name}"`)
  }
}
