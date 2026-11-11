import { GERMAN_ROTATE_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Public authored content only. Never interpolate a PDF, filename, or user input. */
export function germanRotateArticleHtml(): string {
  return germanToolLandingHtml({ id: 'rotate', route: '/rotate' }, GERMAN_ROTATE_COPY, { includeHeader: false }) + `
  <section aria-labelledby="rotation-modes-de">
    <h2 id="rotation-modes-de">PDF-Seiten einzeln oder gemeinsam drehen</h2>
    <p>Wähle eine PDF-Datei und markiere die gewünschten Seiten in der Vorschau. Mit „Nach links drehen“ oder „Nach rechts drehen“ änderst du die Ausrichtung in 90-Grad-Schritten. Du kannst auch alle Seiten markieren. Bereits vorhandene Drehungen werden berücksichtigt.</p>
    <p>Bei längeren Dokumenten werden je acht Vorschaubilder angezeigt. Mit den Schaltflächen für vorherige und nächste Seiten navigierst du durch die Vorschau. Die Auswahl und die Änderungen bleiben dabei erhalten.</p>
    <p>Prüfe die Ausrichtung, bevor du „Gedrehte Kopie erstellen“ auswählst. Ohne Änderung wird keine neue Datei erzeugt. Mit „Rückgängig“ lassen sich Änderungen schrittweise zurücknehmen.</p>
  </section>
  <section aria-labelledby="rotation-limits-de">
    <h2 id="rotation-limits-de">Dateigrenzen, Ergebnis und mögliche Verluste</h2>
    <p>Das Werkzeug verarbeitet eine PDF-Datei lokal im Browser. Die allgemeinen Grenzen liegen bei 50 MiB und 300 Seiten. Passwortgeschützte Dateien können nicht entsperrt werden. Ein neues PDF wird erstellt und vor dem Download geprüft.</p>
    <p>Die Originaldatei bleibt unverändert. Beim Neuschreiben können interaktive Formulare, Anmerkungen, Lesezeichen und Metadaten verloren gehen oder sich verändern. Digitale Signaturen können ungültig werden. Drehen entfernt keine vertraulichen Inhalte.</p>
    <p>Bewahre das Original auf und prüfe die heruntergeladene Datei in einem unabhängigen PDF-Programm. Der Download verbleibt auf deinem Gerät.</p>
  </section>
  <section aria-labelledby="rotation-privacy-de">
    <h2 id="rotation-privacy-de">Datenschutz und Fehlerbehebung</h2>
    <p>Ausgewählte PDF-Inhalte werden zur Verarbeitung nicht an einen Konvertierungsserver hochgeladen. Der Browser lädt die Website und benötigte Programmdateien von GitHub Pages. Verwende „Neu beginnen“, um die Arbeitsbereich-Auswahl und Ergebnisse zu entfernen; bereits gespeicherte Downloads bleiben erhalten.</p>
    <p>Wenn eine benötigte Programmdatei nicht geladen werden kann, kann das Neuladen der Seite erforderlich sein. Dadurch gehen Dateiauswahl und Einstellungen im Arbeitsbereich verloren. Wähle anschließend das Original erneut aus.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge">
    <h2>Weitere Werkzeuge</h2>
    <ul>
      <li><a href="/pdf-tools/de/merge/" hreflang="de">PDFs zusammenfügen</a></li>
      <li><a href="/pdf-tools/de/split/" hreflang="de">PDF teilen</a></li>
      <li><a href="/pdf-tools/organize/" hreflang="en">PDF-Seiten organisieren (Englisch)</a></li>
      <li><a href="/pdf-tools/help/" hreflang="en">Hilfe und FAQ (Englisch)</a></li>
    </ul>
  </nav>`
}
export function germanRotateStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDF drehen</span></nav>
  <h1>${escapeHtml(GERMAN_ROTATE_COPY.heading)}</h1>
  <p>${escapeHtml(GERMAN_ROTATE_COPY.description)}</p>
  <p>Aktiviere JavaScript, um PDF-Seiten lokal im Browser zu drehen. Die Hinweise kannst du auch ohne JavaScript lesen.</p>` + germanRotateArticleHtml()
}
