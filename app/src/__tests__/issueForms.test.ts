import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '../.github/ISSUE_TEMPLATE')
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')
const bug = read('bug_report.yml')
const feature = read('feature_request.yml')
const config = read('config.yml')

describe('PT-OPS-002 issue reporting safety contract', () => {
  it('publishes two public forms with distinct field ids and required checkboxes', () => {
    for (const file of [bug, feature]) {
      expect(file).toContain('body:\\n'.replace('\\n', '\n'))
      expect(file).toContain('type: markdown')
      expect(file).toContain('type: checkboxes')
      expect(file).toContain('required: true')
      expect(file.toLowerCase()).toContain('public')
      const ids = [...file.matchAll(/^    id: ([a-z-]+)$/gm)].map(match => match[1])
      expect(ids.length).toBeGreaterThanOrEqual(6)
      expect(new Set(ids).size).toBe(ids.length)
      expect(file).toContain('https://github.com/Akshat4112/pdf-tools/security')
      expect(file).toContain('synthetic')
      expect(file).not.toContain('upload your PDF')
    }
  })
  it('records enough sanitized reproduction details without requiring actual PDFs', () => {
    for (const key of ['affected-tool','browser','platform','reproduce','expected','actual','synthetic-input','privacy-check']) expect(bug).toContain('id: '+key)
    expect(bug).toContain('Synthetic PDF')
    expect(bug).toContain('Cannot reproduce without private data')
    for (const key of ['problem','solution','area','alternatives','privacy','public-confirmation']) expect(feature).toContain('id: '+key)
    expect(feature).toContain('not a promise of availability')
  })
  it('uses only real public guides and does not advertise a confidential inbox', () => {
    expect(config).toContain('blank_issues_enabled: false')
    expect(config).toContain('https://akshat4112.github.io/pdf-tools/help/')
    expect(config).toContain('https://akshat4112.github.io/pdf-tools/trust/')
    expect(config).toContain('https://github.com/Akshat4112/pdf-tools/security')
    expect(config).toContain('may not be enabled')
    expect(config).not.toMatch(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/i)
  })
})
