import type { PageMeta } from './pageMetadata.ts'
import { GERMAN_EXTRACT_COPY } from './germanToolSeo.ts'

/** Indexable only alongside the complete German Extract workflow. */
export const GERMAN_EXTRACT_META: PageMeta = {
  title: GERMAN_EXTRACT_COPY.title,
  description: GERMAN_EXTRACT_COPY.description,
  canonical: 'https://akshat4112.github.io/pdf-tools/de/extract-pages/',
  ogType: 'website',
}
