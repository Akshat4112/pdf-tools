import type { PageMeta } from './pageMetadata.ts'
import { GERMAN_ROTATE_COPY } from './germanToolSeo.ts'

/** German Rotate is published only when its complete workflow passes release gates. */
export const GERMAN_ROTATE_META: PageMeta = {
  title: GERMAN_ROTATE_COPY.title,
  description: GERMAN_ROTATE_COPY.description,
  canonical: 'https://akshat4112.github.io/pdf-tools/de/rotate/',
  ogType: 'website',
}
