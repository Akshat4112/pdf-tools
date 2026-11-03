import { germanSplitArticleHtml } from '../lib/germanSplitContent'

/** Load public German Split guidance independently of the active workspace. */
export default function GermanSplitGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanSplitArticleHtml() }} />
}
