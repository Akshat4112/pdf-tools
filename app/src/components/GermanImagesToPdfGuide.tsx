import { germanImagesToPdfArticleHtml } from '../lib/germanImagesToPdfContent'

export default function GermanImagesToPdfGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanImagesToPdfArticleHtml() }} />
}
