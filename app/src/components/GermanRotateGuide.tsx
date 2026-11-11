import { germanRotateArticleHtml } from '../lib/germanRotateContent'

/** Noncritical German guidance stays separate from the active PDF workspace. */
export default function GermanRotateGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanRotateArticleHtml() }} />
}
