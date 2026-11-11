import { GERMAN_DELETE_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Authored public copy only, not document-derived data. */
export function germanDeleteArticleHtml(): string {
  return germanToolLandingHtml({ id: 'delete-pages', route: '/delete-pages' }, GERMAN_DELETE_COPY, { includeHeader: false }) + `
  <section aria-labelledby="delete-selection-de">
    <h2 id="delete-selection-de">Seiten markieren und Entfernen bestätigen</h2>
    <p>Öffne eine PDF-Datei und markiere die Seiten, die aus einer neuen Kopie entfernt werden sollen. Nutze die Miniaturansichten oder gib Seitenzahlen und Bereiche ein, beispielsweise 2, 4-5. Wiederholte Seitenzahlen werden nur einmal berücksichtigt. Mindestens eine Seite muss im Dokument bleiben.</p>
    <p>Prüfe in der Vorschau die zu entfernenden Seiten und die Reihenfolge der verbleibenden Seiten. Bestätige den Löschvorgang ausdrücklich; ohne diese Bestätigung wird die neue Datei nicht erstellt. Die Originaldatei wird nicht verändert.</p>
  </section>
  <section aria-labelledby="delete-limitations-de">
    <h2 id="delete-limitations-de">Grenzen und Sicherheit</h2>
    <p>Das Werkzeug verarbeitet PDF-Dateien lokal im Browser, mit allgemeinen Grenzen von 50 MiB und 300 Seiten. Geschützte PDFs können nicht entsperrt werden. Digitale Signaturen können nach dem Speichern einer bearbeiteten Kopie ungültig sein; Formulare, Lesezeichen und Metadaten bleiben möglicherweise nicht erhalten.</p>
    <p><strong>Wichtig:</strong> Das Entfernen ganzer Seiten ist keine sichere Schwärzung. Vertrauliche Informationen können auf anderen Seiten oder in zusätzlichen Dokumentstrukturen erhalten bleiben. Prüfe das Ergebnis sorgfältig und bewahre das Original auf.</p>
  </section>
  <section aria-labelledby="delete-privacy-de">
    <h2 id="delete-privacy-de">Datenschutz und Neustart</h2>
    <p>PDF-Inhalte werden nicht zur Verarbeitung an einen Konvertierungsserver gesendet. Die Website und benötigte Programmdateien werden jedoch von GitHub Pages geladen. „Neu beginnen“ setzt ausgewählte Dateien und Ergebnisse in diesem Arbeitsbereich zurück, entfernt aber keine bereits gespeicherten Downloads.</p>
    <p>Bei Problemen mit der geladenen PDF-Programmdatei kann ein Neuladen notwendig sein. Dabei gehen die aktuelle Dateiauswahl und Einstellungen verloren; wähle die Originaldatei anschließend erneut aus.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge"><h2>Weitere Werkzeuge</h2>
    <ul>
      <li><a href="/pdf-tools/de/rotate/" hreflang="de">PDF drehen</a></li>
      <li><a href="/pdf-tools/de/split/" hreflang="de">PDF teilen</a></li>
      <li><a href="/pdf-tools/extract-pages/" hreflang="en">PDF-Seiten extrahieren (Englisch)</a></li>
      <li><a href="/pdf-tools/help/" hreflang="en">Hilfe und FAQ (Englisch)</a></li>
    </ul></nav>`
}
export function germanDeleteStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDF-Seiten entfernen</span></nav>
  <h1>${escapeHtml(GERMAN_DELETE_COPY.heading)}</h1><p>${escapeHtml(GERMAN_DELETE_COPY.description)}</p>
  <p>Aktiviere JavaScript, um ganze PDF-Seiten lokal im Browser zu entfernen. Diese Hinweise sind auch ohne JavaScript lesbar.</p>` + germanDeleteArticleHtml()
}
