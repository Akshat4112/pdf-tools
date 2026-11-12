import { germanExtractArticleHtml } from '../lib/germanExtractContent'
export default function GermanExtractGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanExtractArticleHtml() }} />
}
