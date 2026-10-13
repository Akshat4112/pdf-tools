import { organizePdf, type OrganizePlanEntry } from '../engines/pdflib'
import { openDocument, type PdfjsPage } from '../engines/pdfjs'
import { runJob, CancelledError, type JobEvents } from '../jobs/orchestrator'
import { verifyOutput } from '../outputs/verify'
import { toolError } from '../registry'
import { validateOrganizePlan } from './organizePlan'

export interface OrganizeInput {
  file: { displayName: string; bytes: Uint8Array }
  plan: readonly OrganizePlanEntry[]
  mode?: 'organize' | 'rotate'
}

async function pageEvidence(page: PdfjsPage, rotation = page.rotate) {
  try {
    const size = page.getViewport({ scale: 1, rotation })
    const text = (await page.getTextContent()).items.map((item) => item.str).join(' ').trim()
    return { width: size.width, height: size.height, rotation, text }
  } finally { page.cleanup() }
}

/** Export the frozen preview plan, then independently read back every output page. */
export function startOrganize(input: OrganizeInput, events: JobEvents = {}) {
  const snapshot = { ...input, file: { ...input.file }, plan: input.plan.map((p) => ({ ...p })) }
  return runJob(input.mode ?? 'organize', snapshot, async (inp, ctx) => {
    const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
    check()
    const source = await openDocument(inp.file.bytes)
    const expected: Awaited<ReturnType<typeof pageEvidence>>[] = []
    try {
      validateOrganizePlan(inp.plan, source.numPages)
      if (inp.mode === 'rotate' && (inp.plan.length !== source.numPages || inp.plan.some((p, i) => p.sourcePage !== i + 1))) {
        throw toolError('E-CONFIG-01', 'Rotate keeps every source page in its original order.', 'fix-field')
      }
      const cache = new Map<string, Awaited<ReturnType<typeof pageEvidence>>>()
      for (let i = 0; i < inp.plan.length; i++) {
        check()
        const entry = inp.plan[i]
        const key = `${entry.sourcePage}:${entry.rotation}`
        let evidence = cache.get(key)
        if (!evidence) { evidence = await pageEvidence(await source.getPage(entry.sourcePage), entry.rotation); cache.set(key, evidence) }
        expected.push(evidence)
        ctx.reportProgress(0.25 * (i + 1) / inp.plan.length, `Reading page ${i + 1} of ${inp.plan.length}`)
      }
    } finally { await source.destroy() }
    check()
    const bytes = await organizePdf(inp.file.bytes, inp.plan)
    ctx.reportProgress(0.55, 'Checking the new copy')
    check()
    const output = await openDocument(bytes)
    try {
      if (output.numPages !== inp.plan.length) throw toolError('E-OUT-01', 'The output page count does not match the preview.', 'retry-job')
      for (let i = 0; i < expected.length; i++) {
        check()
        const actual = await pageEvidence(await output.getPage(i + 1))
        const wanted = expected[i]
        if (actual.rotation !== wanted.rotation || Math.abs(actual.width - wanted.width) > 0.01 || Math.abs(actual.height - wanted.height) > 0.01 || actual.text !== wanted.text) {
          throw toolError('E-OUT-01', `Output page ${i + 1} does not match the preview.`, 'retry-job')
        }
        ctx.reportProgress(0.55 + 0.4 * (i + 1) / expected.length, `Verified page ${i + 1} of ${expected.length}`)
      }
    } finally { await output.destroy() }
    check()
    const stem = inp.file.displayName.replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g, '_').slice(0, 50) || 'document'
    return verifyOutput({ name: `${stem}-${inp.mode === 'rotate' ? 'rotated' : 'organized'}.pdf`, mimeType: 'application/pdf', bytes, expectedPages: inp.plan.length })
  }, events)
}
