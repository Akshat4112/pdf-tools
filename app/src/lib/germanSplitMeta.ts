import type { PageMeta } from './pageMetadata.ts'
import { GERMAN_SPLIT_COPY } from './germanToolSeo.ts'

/** Translated Split workflow; other unreviewed German URLs remain gated. */
export const GERMAN_SPLIT_META: PageMeta = {
  title: GERMAN_SPLIT_COPY.title,
  description: GERMAN_SPLIT_COPY.description,
  canonical: 'https://akshat4112.github.io/pdf-tools/de/split/',
  ogType: 'website',
}
