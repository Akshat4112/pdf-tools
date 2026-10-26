import { publicInfoHtml } from '../lib/publicInfo'
/** Public, authored content only. Unknown route keys never interpolate input. */
export function InfoPage({ path }: { path: string }) {
  return <div dangerouslySetInnerHTML={{ __html: publicInfoHtml(path) ?? '' }} />
}
