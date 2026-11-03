import { GERMAN_SPLIT_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Authored public copy only; selected files and range input never enter this HTML. */
export function germanSplitArticleHtml(): string {
  return germanToolLandingHtml({ id: 'split', route: '/split' }, GERMAN_SPLIT_COPY, { includeHeader: false }) + `
  <section aria-labelledby="split-modes-de">
    <h2 id="split-modes-de">Drei Arten der Aufteilung</h2>
    <ul>
      <li><strong>Eigene Seitenbereiche:</strong> Trenne Seitenbereiche mit Kommas, zum Beispiel 3-4, 1-2. Jeder Bereich erzeugt eine PDF-Datei in der angegebenen Reihenfolge. Nicht gewählte Seiten werden nicht übernommen. Bereiche dürfen sich überschneiden; dieselbe Seite kann daher in mehreren Teilen vorkommen.</li>
      <li><strong>Alle N Seiten:</strong> Lege eine positive ganze Seitenzahl pro Datei fest. Das gesamte Dokument wird aufgeteilt; der letzte Teil kann kürzer sein.</li>
      <li><strong>Eine Datei pro Seite:</strong> Jede Seite wird zu einer eigenen PDF-Datei.</li>
    </ul>
    <p>Prüfe die Vorschau und die Seiten jedes Teils vor dem Start. Ein einzelner eigener Bereich teilt das Dokument nicht: Ergänze einen weiteren Bereich oder nutze „PDF-Seiten extrahieren“ (derzeit auf Englisch). Seitenzahlen beginnen bei 1. Rückwärtsbereiche und Seiten außerhalb des Dokuments sind ungültig.</p>
  </section>
  <section aria-labelledby="split-formats-de">
    <h2 id="split-formats-de">Formate, Download und Grenzen</h2>
    <p>Wähle eine PDF-Datei mit höchstens 50 MiB und 300 Seiten. Es entstehen höchstens 300 PDF-Teile. Passwortgeschützte oder verschlüsselte Dateien werden nicht entsperrt.</p>
    <p>Die Teile werden in einer ZIP-Datei heruntergeladen. Entpacke sie auf deinem Gerät und prüfe jede PDF-Datei vor der weiteren Verwendung. Die Originaldatei bleibt unverändert. Nummerierte Dateinamen zeigen die Reihenfolge der Teile an.</p>
  </section>
  <section aria-labelledby="split-example-de">
    <h2 id="split-example-de">Ein einfaches Beispiel</h2>
    <p>Bei einer synthetischen PDF-Datei mit fünf Seiten erzeugt „Alle N Seiten“ mit dem Wert 2 drei Dateien: Seiten 1–2, 3–4 und 5. Die Eingabe 3-4, 1 erzeugt dagegen zwei Dateien in dieser Reihenfolge: Seiten 3–4 und Seite 1.</p>
  </section>
  <section aria-labelledby="split-caveats-de">
    <h2 id="split-caveats-de">Originale, Datenschutz und Neu beginnen</h2>
    <p>Bewahre das Original auf. Interaktive Formulare, Anmerkungen, Lesezeichen und Metadaten bleiben beim Neuschreiben möglicherweise nicht erhalten. Digitale Signaturen können ungültig werden. Aufteilen ist keine sichere Schwärzung und prüft nicht auf vertrauliche Inhalte.</p>
    <p>Mit „Neu beginnen“ entfernst du die ausgewählte Datei und Ergebnisse aus diesem Arbeitsbereich. Originale und bereits gespeicherte Downloads auf deinem Gerät werden nicht gelöscht. Das ist keine garantierte sichere Löschung des Betriebssystemspeichers.</p>
    <p>Wenn eine für die Verarbeitung benötigte Website-Datei nicht geladen werden kann, kann ein erneutes Laden der Seite nötig sein. Dabei gehen die Auswahl und Einstellungen im Arbeitsbereich verloren; wähle die Originaldatei danach erneut aus.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge">
    <h2>Weitere Werkzeuge und Anleitungen</h2>
    <ul>
      <li><a href="/pdf-tools/de/merge/" hreflang="de">PDFs zusammenfügen</a></li>
      <li><a href="/pdf-tools/extract-pages/" hreflang="en">PDF-Seiten extrahieren (Englisch)</a></li>
      <li><a href="/pdf-tools/guides/share-selected-pages/" hreflang="en">Ausgewählte Seiten weitergeben (Englisch)</a></li>
      <li><a href="/pdf-tools/help/" hreflang="en">Hilfe und FAQ (Englisch)</a></li>
    </ul>
  </nav>`
}

export function germanSplitStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDF teilen</span></nav>
  <h1>PDF in mehrere Dateien aufteilen</h1>
  <p>${escapeHtml(GERMAN_SPLIT_COPY.description)}</p>
  <p>Aktiviere JavaScript, um Dateien lokal in deinem Browser aufzuteilen. Die Anleitung und Hinweise kannst du auch ohne JavaScript lesen.</p>` + germanSplitArticleHtml()
}
