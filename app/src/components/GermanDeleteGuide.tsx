import { germanDeleteArticleHtml } from '../lib/germanDeleteContent'
export default function GermanDeleteGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanDeleteArticleHtml() }} />
}
