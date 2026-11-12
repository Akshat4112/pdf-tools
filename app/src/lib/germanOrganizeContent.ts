import { GERMAN_ORGANIZE_COPY } from './germanToolSeo.ts'
import { germanToolLandingHtml } from './germanToolLanding.ts'
import { escapeHtml } from './pageMetadata.ts'

/** Static editorial HTML only. Never include names, text or metadata from uploaded PDFs. */
export function germanOrganizeArticleHtml(): string {
  return germanToolLandingHtml({ id: 'organize', route: '/organize' }, GERMAN_ORGANIZE_COPY, { includeHeader: false }) + `
  <section aria-labelledby="organize-order-de">
    <h2 id="organize-order-de">Seiten sortieren – auch ohne Drag-and-drop</h2>
    <p>Du kannst Seiten mit dem Ziehgriff umsortieren. Auf dem Handy und mit Tastatur oder Screenreader verwendest du die Schaltflächen „Früher“ und „Später“ oder markierst genau eine Seite und gibst die Zielposition ein. Die Vorschau zeigt die tatsächliche Reihenfolge der Ausgabeseiten. Nutze „Rückgängig“ oder „Original wiederherstellen“, falls du dich vertippt hast.</p>
    <p>Markiere einzelne Seiten zum Drehen, Duplizieren oder Entfernen. Kopierte Seiten lassen sich anschließend unabhängig drehen und verschieben. Das Werkzeug lässt mindestens eine Ausgabeseite stehen und begrenzt die Ausgabe auf 300 Seiten.</p>
  </section>
  <section aria-labelledby="organize-safety-de">
    <h2 id="organize-safety-de">Sicherheit und Grenzen</h2>
    <p>Wenn du Originalseiten entfernst, musst du vor dem Speichern ausdrücklich bestätigen, welche Seiten fehlen. Die Originaldatei wird nicht verändert. Das Entfernen von Seiten ist <strong>keine sichere Schwärzung</strong>. Inhalte auf anderen Seiten oder in zusätzlichen Dokumentstrukturen können erhalten bleiben.</p>
    <p>Es gelten allgemeine Grenzen von 50 MiB pro Datei und 300 Seiten. Passwortgeschützte Dateien lassen sich nicht entsperren. Durch das Neuschreiben können digitale Signaturen ungültig werden und interaktive Formulare, Lesezeichen oder Metadaten verloren gehen. Kontrolliere das Ergebnis vor dem Teilen.</p>
  </section>
  <section aria-labelledby="organize-privacy-de">
    <h2 id="organize-privacy-de">Lokale Verarbeitung und Neustart</h2>
    <p>Die PDF-Bearbeitung erfolgt im Browser. Die Datei wird nicht an einen Konvertierungsserver gesendet. Die Website und die benötigten Programmdateien werden von GitHub Pages abgerufen.</p>
    <p>Mit „Neu beginnen“ werden Dateien, Einstellungen und Arbeitsergebnisse aus diesem Arbeitsbereich entfernt, nicht aber bereits gespeicherte Downloads. Falls eine Programmdatei nicht lädt, aktualisiere die Seite und wähle das PDF erneut aus.</p>
  </section>
  <nav class="related-tools" aria-label="Weitere PDF-Werkzeuge"><h2>Weitere Werkzeuge</h2><ul>
    <li><a href="/pdf-tools/de/rotate/" hreflang="de">PDF drehen</a></li>
    <li><a href="/pdf-tools/de/delete-pages/" hreflang="de">PDF-Seiten entfernen</a></li>
    <li><a href="/pdf-tools/de/extract-pages/" hreflang="de">PDF-Seiten extrahieren</a></li>
    <li><a href="/pdf-tools/de/split/" hreflang="de">PDF teilen</a></li>
  </ul></nav>`
}

export function germanOrganizeStaticHtml(): string {
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">PDF-Seiten organisieren</span></nav>
  <h1>${escapeHtml(GERMAN_ORGANIZE_COPY.heading)}</h1><p>${escapeHtml(GERMAN_ORGANIZE_COPY.description)}</p>
  <p>Aktiviere JavaScript, um PDF-Seiten direkt im Browser zu bearbeiten. Diese Hinweise sind auch ohne JavaScript lesbar.</p>` + germanOrganizeArticleHtml()
}
