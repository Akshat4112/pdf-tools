import { GERMAN_PDF_TO_JPG_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Authored public guidance only: never include uploaded PDF contents or filenames. */
export function germanPdfToJpgArticleHtml(): string {
  return germanToolLandingHtml({ id: 'pdf-to-jpg', route: '/pdf-to-jpg' }, GERMAN_PDF_TO_JPG_COPY, { includeHeader: false }) + `
  <section aria-labelledby="jpg-pages-de">
    <h2 id="jpg-pages-de">PDF-Seiten auswählen und als JPG exportieren</h2>
    <p>Lade deine PDF-Datei und wähle die Seiten über die Vorschaubilder oder das Feld für Seitenbereiche. Du kannst einzelne Seiten oder Bereiche wie 3, 1, 5-8 eingeben. Die Bilddateien folgen der von dir angegebenen Reihenfolge. Wiederholte Seitenzahlen werden nur einmal berücksichtigt.</p>
    <p>Bestimme die Auflösung in DPI und die JPG-Qualität. Höhere Werte können größere Bilder erzeugen. JPG hat immer einen weißen Hintergrund; die Komprimierung kann feine Details verändern. Kontrolliere die Vorschaubilder und lade einzelne JPGs oder die ZIP-Datei herunter.</p>
  </section>
  <section aria-labelledby="jpg-limits-de">
    <h2 id="jpg-limits-de">Grenzen und Sicherheit</h2>
    <p>Die Verarbeitung erfolgt lokal im Browser. Die PDF-Datei wird nicht zur Konvertierung hochgeladen. Es gelten Grenzen von 50 MiB Dateigröße, 300 PDF-Seiten, 8192 Pixeln pro Bildseite, 16 Millionen Pixeln pro Bild und 50 MiB für die erzeugten Bilddateien insgesamt.</p>
    <p>Passwortgeschützte PDF-Dateien lassen sich nicht entsperren. Bei der Umwandlung werden die Seiten gerendert, nicht ihre eingebetteten Originalbilder extrahiert. Das Bild enthält keine durchsuchbare Textebene, und kleinere Schrift kann bei niedriger Auflösung unscharf werden. Die ursprüngliche PDF-Datei bleibt unverändert.</p>
  </section>
  <section aria-labelledby="jpg-privacy-de">
    <h2 id="jpg-privacy-de">Datenschutz und Neustart</h2>
    <p>Die Website und erforderliche Programmdateien werden von GitHub Pages geladen. Mit „Neu beginnen“ entfernst du die Auswahl, Einstellungen und erzeugten Ergebnisse aus dem Arbeitsbereich, nicht jedoch heruntergeladene Dateien. Falls eine benötigte Datei nicht geladen werden kann, aktualisiere die Seite und wähle das Original erneut aus.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge"><h2>Weitere Werkzeuge</h2><ul>
    <li><a href="/pdf-tools/de/images-to-pdf/" hreflang="de">Bilder zu PDF</a></li>
    <li><a href="/pdf-tools/de/extract-pages/" hreflang="de">PDF-Seiten extrahieren</a></li>
    <li><a href="/pdf-tools/pdf-to-png/" hreflang="en">PDF in PNG umwandeln (Englisch)</a></li>
  </ul></nav>`
}
export function germanPdfToJpgStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDF in JPG umwandeln</span></nav>
  <h1>${escapeHtml(GERMAN_PDF_TO_JPG_COPY.heading)}</h1><p>${escapeHtml(GERMAN_PDF_TO_JPG_COPY.description)}</p>
  <p>Aktiviere JavaScript, um PDF-Seiten im Browser in JPG-Bilder umzuwandeln. Diese Hinweise sind auch ohne JavaScript lesbar.</p>` + germanPdfToJpgArticleHtml()
}
