import { GERMAN_IMAGES_TO_PDF_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Static editorial HTML only; no user files, filenames or input metadata. */
export function germanImagesToPdfArticleHtml(): string {
  return germanToolLandingHtml({ id: 'images-to-pdf', route: '/images-to-pdf' }, GERMAN_IMAGES_TO_PDF_COPY, { includeHeader: false }) + `
  <section aria-labelledby="img-settings-de">
    <h2 id="img-settings-de">Seitenformat und Bildanpassung wählen</h2>
    <p>Wähle statische JPG- oder PNG-Bilder aus. Jedes Bild erhält eine eigene PDF-Seite. Sortiere die Dateien vor dem Export in die gewünschte Reihenfolge. Für das Seitenformat stehen A4, Letter und die Originalbildgröße zur Verfügung. Bei A4 und Letter kannst du die Seitenausrichtung wählen.</p>
    <p>Mit „Ganzes Bild einpassen“ bleibt das gesamte Motiv sichtbar; es können weiße Ränder entstehen. „Seite füllen“ schneidet Bildränder möglicherweise ab. Bestimme die Seitenränder in Punkten (72 Punkte entsprechen einem Zoll), prüfe die Vorschau und lade die neue PDF-Datei herunter.</p>
  </section>
  <section aria-labelledby="img-limits-de">
    <h2 id="img-limits-de">Verarbeitung, Grenzen und Fehler</h2>
    <p>Die Verarbeitung erfolgt lokal im Browser, ohne Upload der Bilder zur Konvertierung. Die Website und die Programmdateien werden über GitHub Pages geladen. Es sind maximal 300 Bilder, 50 MiB Gesamtgröße, 16 Millionen Bildpunkte pro Bild und 25,6 Millionen Bildpunkte insgesamt zulässig. Animierte Bilder und andere Dateiformate werden nicht unterstützt.</p>
    <p>Transparente Flächen und Seitenränder werden weiß. Farbprofile und Bildqualität können sich nach dem Export unterscheiden. Prüfe daher alle Seiten. Bilder werden eingebettet; diese Funktion erzeugt keine OCR-Textebene. Deine Originalbilder bleiben unverändert.</p>
  </section>
  <section aria-labelledby="img-privacy-de">
    <h2 id="img-privacy-de">Datenschutz und Neustart</h2>
    <p>Mit „Neu beginnen“ werden Eingabedateien, Einstellungen und Ergebnisse aus der Anwendung entfernt; bereits heruntergeladene Dateien bleiben auf deinem Gerät. Falls eine benötigte Programmdatei nicht geladen werden kann, aktualisiere die Seite und wähle deine Bilder erneut aus.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge"><h2>Weitere Werkzeuge</h2><ul>
    <li><a href="/pdf-tools/de/merge/" hreflang="de">PDFs zusammenfügen</a></li>
    <li><a href="/pdf-tools/de/organize/" hreflang="de">PDF-Seiten organisieren</a></li>
    <li><a href="/pdf-tools/pdf-to-jpg/" hreflang="en">PDF in JPG umwandeln (Englisch)</a></li>
  </ul></nav>`
}
export function germanImagesToPdfStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">Bilder in PDF umwandeln</span></nav>
    <h1>${escapeHtml(GERMAN_IMAGES_TO_PDF_COPY.heading)}</h1><p>${escapeHtml(GERMAN_IMAGES_TO_PDF_COPY.description)}</p>
    <p>Aktiviere JavaScript, um Bilder im Browser in PDF umzuwandeln. Diese Hinweise sind auch ohne JavaScript lesbar.</p>` + germanImagesToPdfArticleHtml()
}
