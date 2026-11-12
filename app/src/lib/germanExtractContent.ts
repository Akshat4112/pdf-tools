import { GERMAN_EXTRACT_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Publicly authored help only; never interpolate filenames or PDF contents. */
export function germanExtractArticleHtml(): string {
  return germanToolLandingHtml({ id: 'extract-pages', route: '/extract-pages' }, GERMAN_EXTRACT_COPY, { includeHeader: false }) + `
  <section aria-labelledby="extract-choose-de">
    <h2 id="extract-choose-de">Einzelne PDF-Seiten auswählen</h2>
    <p>Wähle eine PDF-Datei und markiere Seiten über die Miniaturansichten oder das Eingabefeld. Trenne die Seitenzahlen durch Kommas und verwende für zusammenhängende Bereiche einen Bindestrich, zum Beispiel 1, 3-5, 8. Wiederholte Seitenzahlen werden nur einmal berücksichtigt. Die neue PDF-Kopie enthält die ausgewählten Seiten in aufsteigender Reihenfolge des Originals.</p>
    <p>Die Vorschau zeigt die Anzahl und Reihenfolge der Ausgabeseiten. Nicht ausgewählte Seiten erscheinen nicht in der erzeugten Kopie. Das Original bleibt unverändert. Prüfe das Ergebnis, bevor du die Datei weitergibst.</p>
  </section>
  <section aria-labelledby="extract-limits-de">
    <h2 id="extract-limits-de">Grenzen und wichtige Hinweise</h2>
    <p>Die Verarbeitung erfolgt lokal im Browser. Es gelten allgemeine Grenzen von 50 MiB Dateigröße und 300 Seiten. Passwortgeschützte PDF-Dateien können nicht entsperrt werden. Bei neu erzeugten Dateien können digitale Signaturen ungültig werden und interaktive Formulare, Lesezeichen oder Metadaten verloren gehen.</p>
    <p>Das Extrahieren ist <strong>keine sichere Schwärzung</strong> und keine Datenschutzprüfung. Vertrauliche Informationen können auf den übernommenen Seiten oder in anderen Dokumentstrukturen enthalten bleiben.</p>
  </section>
  <section aria-labelledby="extract-privacy-de">
    <h2 id="extract-privacy-de">Datenschutz und erneuter Versuch</h2>
    <p>PDF-Inhalte werden nicht zur Konvertierung an einen Server hochgeladen. Website und erforderliche Programmdateien werden von GitHub Pages geladen. Mit „Neu beginnen“ entfernst du Auswahl und Ergebnisse aus diesem Arbeitsbereich, aber keine Downloads auf deinem Gerät.</p>
    <p>Falls eine erforderliche PDF-Programmdatei nicht geladen werden kann, lade die Seite neu und wähle das Original erneut aus. Dabei gehen die vorherige Dateiauswahl und Einstellungen verloren.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge">
    <h2>Weitere Werkzeuge</h2><ul>
    <li><a href="/pdf-tools/de/delete-pages/" hreflang="de">PDF-Seiten entfernen</a></li>
    <li><a href="/pdf-tools/de/split/" hreflang="de">PDF teilen</a></li>
    <li><a href="/pdf-tools/organize/" hreflang="en">PDF-Seiten organisieren (Englisch)</a></li>
    <li><a href="/pdf-tools/help/" hreflang="en">Hilfe (Englisch)</a></li>
    </ul>
  </nav>`
}
export function germanExtractStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDF-Seiten extrahieren</span></nav>
  <h1>${escapeHtml(GERMAN_EXTRACT_COPY.heading)}</h1><p>${escapeHtml(GERMAN_EXTRACT_COPY.description)}</p>
  <p>Aktiviere JavaScript, um PDF-Seiten im Browser auszuwählen und zu extrahieren. Diese Hinweise sind auch ohne JavaScript lesbar.</p>` + germanExtractArticleHtml()
}
