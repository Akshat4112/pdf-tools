import { germanPdfToJpgArticleHtml } from '../lib/germanPdfToJpgContent'

export default function GermanPdfToJpgGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanPdfToJpgArticleHtml() }} />
}
