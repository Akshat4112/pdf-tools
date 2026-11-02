import { GERMAN_MERGE_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Authored public guidance; never constructed from selected PDFs or names. */
export function germanMergeArticleHtml(): string {
  return germanToolLandingHtml({ id: 'merge', route: '/merge' }, GERMAN_MERGE_COPY, { includeHeader: false }) + `
  <section aria-labelledby="merge-formats-de">
    <h2 id="merge-formats-de">Formate und Grenzen</h2>
    <p>Wähle mindestens zwei PDF-Dateien. Jede Eingabedatei darf höchstens 50 MiB und 300 Seiten haben; das zusammengefügte Ergebnis ist auf 300 Seiten begrenzt. Passwortgeschützte oder verschlüsselte Dateien werden nicht entsperrt.</p>
    <p>Die Ausgabe ist eine neue PDF-Datei in der angezeigten Reihenfolge. Die Originaldateien bleiben unverändert. Kontrolliere die neue Datei vor der weiteren Verwendung.</p>
  </section>
  <section aria-labelledby="merge-example-de">
    <h2 id="merge-example-de">Ein einfaches Beispiel</h2>
    <p>Wenn du eine synthetische PDF-Datei mit zwei Seiten vor eine Datei mit drei Seiten setzt, enthält das Ergebnis fünf Seiten in dieser Reihenfolge.</p>
  </section>
  <section aria-labelledby="merge-faq-de">
    <h2 id="merge-faq-de">Werden meine Originale verändert?</h2>
    <p>Nein. Es entsteht eine separate Datei. Bewahre die Originale auf: Interaktive Formulare, Anmerkungen, Lesezeichen und Metadaten bleiben beim Neuschreiben möglicherweise nicht erhalten. Digitale Signaturen können ungültig werden. Zusammenfügen ist keine sichere Schwärzung.</p>
    <p>Mit „Neu beginnen“ entfernst du ausgewählte Dateien und Ergebnisse aus diesem Arbeitsbereich. Bereits gespeicherte Downloads und Originale auf deinem Gerät werden nicht gelöscht. Das ist keine garantierte sichere Löschung des Betriebssystemspeichers.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge">
    <h2>Weitere Werkzeuge und Anleitungen</h2>
    <p>Die folgenden Seiten sind derzeit auf Englisch:</p>
    <ul>
      <li><a href="/pdf-tools/tools/organize/" hreflang="en">PDF-Seiten organisieren (Englisch)</a></li>
      <li><a href="/pdf-tools/split/" hreflang="en">PDF teilen (Englisch)</a></li>
      <li><a href="/pdf-tools/guides/" hreflang="en">Praktische PDF-Anleitungen (Englisch)</a></li>
      <li><a href="/pdf-tools/help/" hreflang="en">Hilfe und FAQ (Englisch)</a></li>
    </ul>
  </nav>`
}

export function germanMergeStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDFs zusammenfügen</span></nav>
  <h1>PDF-Dateien zusammenfügen</h1>
  <p>${escapeHtml(GERMAN_MERGE_COPY.description)}</p>
  <p>Aktiviere JavaScript, um Dateien lokal in deinem Browser zusammenzufügen. Die Anleitung und Hinweise kannst du auch ohne JavaScript lesen.</p>` + germanMergeArticleHtml()
}
