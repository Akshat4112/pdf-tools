// PT-SEC-003: deterministic offline dependency-license / lock integrity guard.
// Run from repository root: node scripts/check_supply_chain.mjs
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'app/package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(resolve(root, 'app/package-lock.json'), 'utf8'))
const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Zlib'])

function assert(cond, message) { if (!cond) throw new Error(message) }
function licenseAllowed(expression, devOnly = false) {
  if (typeof expression !== 'string' || !expression.trim()) return false
  if (/SEE LICENSE|UNLICENSED|PROPRIETARY|GPL|AGPL|LGPL|UNKNOWN/i.test(expression)) return false
  if (expression === 'MPL-2.0') return devOnly // lightningcss and platform variants: build tooling only
  // Permit only listed SPDX licenses joined by SPDX AND/OR syntax.
  const tokens = expression.replace(/[()]/g, ' ').trim().split(/\s+/)
  if (!tokens.length || tokens.some(t => !allowed.has(t) && t !== 'AND' && t !== 'OR')) return false
  if (tokens[0] === 'AND' || tokens[0] === 'OR' || ['AND', 'OR'].includes(tokens.at(-1))) return false
  return true
}
function validate() {
  assert(lock.lockfileVersion === 3, 'Expected npm v3 lockfile')
  const rootPackage = lock.packages['']
  assert(rootPackage, 'Missing lockfile root')
  for (const kind of ['dependencies', 'devDependencies']) {
    const requested = pkg[kind] || {}
    const locked = rootPackage[kind] || {}
    assert(JSON.stringify(Object.keys(requested).sort()) === JSON.stringify(Object.keys(locked).sort()), `${kind} drift`)
    for (const [name, version] of Object.entries(requested)) {
      assert(locked[name] === version, `Root lock version mismatch: ${name}`)
      assert(/^\d+\.\d+\.\d+$/.test(version) || (kind === 'devDependencies' && name === 'typescript' && /^~\d+\.\d+\.\d+$/.test(version)), `Dependency must be exact-pinned: ${name} ${version}`)
    }
  }
  const packages = Object.entries(lock.packages).filter(([path]) => path !== '')
  const notices = ['Third-party dependency license inventory (generated from app/package-lock.json)', 'Review package license files/notices in distributed artifacts before release.', '']
  for (const [path, entry] of packages) {
    assert(entry.version, `Missing locked version: ${path}`)
    assert(entry.integrity && entry.resolved?.startsWith('https://registry.npmjs.org/'), `Untrusted or unpinned package source: ${path}`)
    assert(licenseAllowed(entry.license, entry.dev === true), `License not approved or absent: ${path} (${entry.license || 'missing'})`)
    notices.push(`${path.replace(/^node_modules\//, '')}@${entry.version} — ${entry.license}${entry.dev ? ' [build/dev]' : ''}`)
  }
  assert(packages.length > 0, 'Empty dependency graph')
  return { count: packages.length, notices: notices.join('\n') + '\n' }
}
if (process.argv.includes('--self-test')) {
  for (const x of ['GPL-3.0-only', 'AGPL-3.0', 'MIT OR GPL-3.0', 'UNLICENSED', '', undefined, 'LicenseRef-private']) {
    assert(!licenseAllowed(x), `Unsafe license passed: ${x}`)
  }
  for (const x of ['MIT', 'Apache-2.0', '(MIT OR Apache-2.0)', '(MIT AND Zlib)', 'BSD-3-Clause']) assert(licenseAllowed(x), `Expected license rejected: ${x}`)
}
const result = validate()
const target = resolve(root, 'app/public/THIRD_PARTY_LICENSE_INVENTORY.txt')
if (process.argv.includes('--write-notices')) {
  mkdirSync(resolve(root, 'app/public'), { recursive: true })
  writeFileSync(target, result.notices)
}
process.stdout.write(`License and lockfile gate passed: ${result.count} packages checked.\n`)
