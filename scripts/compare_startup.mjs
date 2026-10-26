import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const [baselinePath, candidatePath, outputPath] = process.argv.slice(2)
const baseline = JSON.parse(readFileSync(baselinePath)), candidate = JSON.parse(readFileSync(candidatePath))
// PT-REL-001: +637 raw bytes of authored route metadata; the transferred
// JavaScript gzip budget is tightened from 90KB to 88KB, and readiness/CLS
// relative-to-baseline gates remain unchanged.
const budget = { initialJsBytes:281000, initialJsGzipBytes:88000, initialCssBytes:45000, initialCssGzipBytes:10000 }
for (const [key, max] of Object.entries(budget)) assert(candidate[key] <= max, `${key}: ${candidate[key]} > ${max}`)
assert(candidate.initialJsBytes <= baseline.initialJsBytes * .4, 'Initial JavaScript must shrink at least 60%')
assert(candidate.initialCssBytes <= baseline.initialCssBytes * .2, 'Initial CSS must shrink at least 80%')
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)]
const routes = [...new Set(candidate.samples.map(s => s.route))].map(route => {
  const before = baseline.samples.filter(s => s.route === route), after = candidate.samples.filter(s => s.route === route)
  const result = { route, before:{}, after:{} }
  for (const key of ['readyMs','fcpMs','lcp','cls','blockingMs']) { result.before[key] = median(before.map(s => s[key])); result.after[key] = median(after.map(s => s[key])) }
  assert(result.after.cls <= .1, `${route}: startup CLS exceeds .1`)
  // Shared-runner timing varies; deterministic byte/module gates carry the hard regression budget.
  assert(result.after.readyMs <= result.before.readyMs * 1.2 + 100, `${route}: median readiness regressed materially`)
  return result
})
const result = { budget, baselineCommit:'994069b1a212426101ce7493e0dc038ab67e98ad', baselineAssets:baseline.initialAssets, candidateAssets:candidate.initialAssets, routes, note:'Cold empty-page DevTools lab samples. LCP/CLS are startup observations; blockingMs is long-task excess over 50ms, not Lighthouse TBT. These are not field CWV/INP, p75 traffic or real-device measurements.' }
writeFileSync(outputPath, JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2))
