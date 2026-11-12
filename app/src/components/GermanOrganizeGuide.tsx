import { germanOrganizeArticleHtml } from '../lib/germanOrganizeContent'

export default function GermanOrganizeGuide() {
  return <div dangerouslySetInnerHTML={{ __html: germanOrganizeArticleHtml() }} />
}
