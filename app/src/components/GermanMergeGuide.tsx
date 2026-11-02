import { germanMergeArticleHtml } from '../lib/germanMergeContent'

/** Lazy public copy keeps German guidance out of English startup assets. */
export default function GermanMergeGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanMergeArticleHtml() }} />
}
