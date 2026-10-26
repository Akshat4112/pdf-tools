/** Build/test only. This module must never be imported by the browser entry. */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { zlibSync } from 'fflate'

function pngCrc(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pattern(width: number, height: number) {
  const chunk = (type: string, bytes: Uint8Array) => {
    const out = new Uint8Array(bytes.length + 12), view = new DataView(out.buffer)
    view.setUint32(0, bytes.length); out.set(new TextEncoder().encode(type), 4); out.set(bytes, 8)
    view.setUint32(out.length - 4, pngCrc(out.subarray(4, out.length - 4)))
    return out
  }
  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 2
  const raw = new Uint8Array((width * 3 + 1) * height), colors = [[210, 55, 55], [30, 145, 70], [50, 80, 205], [240, 185, 35]]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)], y * (width * 3 + 1) + 1 + x * 3)
  const chunks = [new Uint8Array([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlibSync(raw)), chunk('IEND', new Uint8Array())]
  const output = new Uint8Array(chunks.reduce((n, part) => n + part.length, 0)); let offset = 0
  for (const part of chunks) { output.set(part, offset); offset += part.length }
  return output
}

export async function createGuideExamples(): Promise<Record<string, Uint8Array>> {
  const landscape = pattern(640, 400), portrait = pattern(400, 640)
  async function textPdf(markers: string[]) {
    const doc = await PDFDocument.create({ updateMetadata: false })
    doc.setTitle('PDF Tools synthetic guide example'); doc.setAuthor('PDF Tools')
    const font = await doc.embedFont(StandardFonts.Helvetica)
    for (const marker of markers) {
      const page = doc.addPage([480, 640])
      page.drawText(marker, { x: 36, y: 560, size: 20, font, color: rgb(.08, .2, .2) })
      page.drawText('Invented sample sentence for a public PDF Tools guide.', { x: 36, y: 510, size: 12, font })
      page.drawText('Synthetic example. No personal information.', { x: 36, y: 60, size: 10, font })
    }
    return doc.save()
  }
  const scan = await PDFDocument.create({ updateMetadata: false }), image = await scan.embedPng(landscape)
  scan.setTitle('PDF Tools synthetic image-only example')
  scan.addPage([480, 300]).drawImage(image, { x: 0, y: 0, width: 480, height: 300 })
  return { 'cover.pdf': await textPdf(['SYNTHETIC_COVER']), 'appendix.pdf': await textPdf(['SYNTHETIC_APPENDIX_1', 'SYNTHETIC_APPENDIX_2']),
    'pages.pdf': await textPdf(['SYNTHETIC_PAGE_1', 'SYNTHETIC_PAGE_2', 'SYNTHETIC_PAGE_3']), 'scan.pdf': await scan.save(), 'landscape.png': landscape, 'portrait.png': portrait }
}
