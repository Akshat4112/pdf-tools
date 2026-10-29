import { germanCatalogHtml } from '../lib/germanCatalog'

/** Loaded only for the German catalog, not as part of English startup assets. */
export default function GermanCatalogPage() {
  return (
    <main id="main-content" tabIndex={-1} className="tool-workspace category-hub"
      dangerouslySetInnerHTML={{ __html: germanCatalogHtml() }} />
  )
}
