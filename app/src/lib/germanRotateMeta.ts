import type { PageMeta } from './pageMetadata.ts'
import { GERMAN_TOOL_SEO } from './germanToolSeo.ts'

/** German Rotate is published only when its complete workflow passes release gates. */
export const GERMAN_ROTATE_META: PageMeta = {
  title: GERMAN_TOOL_SEO.rotate.title,
  description: GERMAN_TOOL_SEO.rotate.description,
  canonical: 'https://akshat4112.github.io/pdf-tools/de/rotate/',
  ogType: 'website',
}
