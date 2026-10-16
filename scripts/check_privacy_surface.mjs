/** R1 guard: intentional storage/network/logging additions need an explicit policy change.
 * Parses app-owned executable source, not comments, dependency internals or tests. */
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../app/package.json', import.meta.url))
const ts = require('typescript')
const forbidden = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'serviceWorker'])
export function violations(source, filename = 'example.ts') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const found = new Set()
  function visit(node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) found.add(node.text)
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(file) === 'document' && node.name.text === 'cookie') found.add('cookie')
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(file) === 'console') found.add('console')
    ts.forEachChild(node, visit)
  }
  visit(file)
  return [...found]
}
// Check the guard's own failure/safe cases without contacting any endpoint.
for (const source of ['fetch("/upload")', 'window.sendBeacon("/log", data)', 'localStorage.setItem("x", text)',
  'indexedDB.open("private")', 'navigator.serviceWorker.register("sw.js")', 'console.error(privateData)', 'document.cookie = "secret"']) {
  assert(violations(source).length > 0)
}
assert.deepEqual(violations('// fetch(secret)\nconst label = "localStorage";'), [])
let count = 0
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    if (entry.isDirectory()) scan(path)
    else if (/\.tsx?$/.test(entry.name)) {
      const found = violations(readFileSync(path, 'utf8'), entry.name)
      assert.deepEqual(found, [], `Privacy policy surface changed: ${path.pathname}: ${found.join(', ')}`)
      count++
    }
  }
}
scan(new URL('../app/src/', import.meta.url))
console.log(`Privacy surface: ${count} app source files checked; no upload/storage/logging APIs.`)
