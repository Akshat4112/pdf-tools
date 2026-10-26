import { publicInfoHtml } from '../lib/publicInfo'
import { guideHtml } from '../lib/guideContent'

/** Kept in an on-demand chunk; the catalog does not download the articles. */
export function GuidePage({ path }: { path: string }) {
  return <div dangerouslySetInnerHTML={{ __html: publicInfoHtml(path) ?? guideHtml(path) ?? '' }} />
}
