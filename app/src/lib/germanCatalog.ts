import { TOOLS, type ToolId } from '../registry.ts'
import type { PageMeta } from './pageMetadata.ts'

/**
 * PT-SEO-010: German catalog is the first fully authored localized page.
 * Tool workflows and legal/help routes still live at their existing English
 * canonical URLs and are explicitly labelled as such here.
 * Never add untranslated tools or policy pages to the German sitemap.
 */
export const GERMAN_CATALOG_META: PageMeta = {
  title: 'PDF-Tools kostenlos im Browser nutzen — PDF Tools',
  description: 'Kostenlose Open-Source-PDF-Tools: PDFs zusammenfügen, teilen, bearbeiten und lesen. Dateien werden im Browser verarbeitet, ohne Benutzerkonto.',
  canonical: 'https://akshat4112.github.io/pdf-tools/de/',
  ogType: 'website',
}

const germanTitles: Record<ToolId, string> = {
  merge: 'PDFs zusammenfügen',
  split: 'PDF teilen',
  rotate: 'PDF drehen',
  'delete-pages': 'PDF-Seiten entfernen',
  'extract-pages': 'PDF-Seiten extrahieren',
  organize: 'PDF-Seiten organisieren',
  'images-to-pdf': 'Bilder in PDF umwandeln',
  'pdf-to-jpg': 'PDF in JPG umwandeln',
  'pdf-to-png': 'PDF in PNG umwandeln',
  reader: 'PDF lesen',
  'page-numbers': 'Seitenzahlen hinzufügen',
  watermark: 'Wasserzeichen hinzufügen',
  'pdf-to-text': 'PDF-Text exportieren',
  'doc-info': 'PDF-Dokumentinformationen prüfen',
}

/** All strings below are authored public copy; never insert document text. */
const descriptions: Record<ToolId, string> = {
  merge: 'Mehrere PDFs in der gewünschten Reihenfolge zu einer Datei verbinden.',
  split: 'Ein PDF nach Seitenbereichen oder in einzelne Seiten aufteilen.',
  rotate: 'Ausgewählte PDF-Seiten um 90 Grad drehen.',
  'delete-pages': 'Ganze Seiten aus einer neuen PDF-Kopie entfernen; keine Schwärzung.',
  'extract-pages': 'Ausgewählte Seiten zu einer neuen PDF-Datei zusammenstellen.',
  organize: 'Seiten sortieren, drehen, kopieren oder entfernen und das Ergebnis prüfen.',
  'images-to-pdf': 'JPG- und PNG-Bilder in ein PDF-Dokument einfügen.',
  'pdf-to-jpg': 'PDF-Seiten als JPG-Bilder exportieren.',
  'pdf-to-png': 'PDF-Seiten als PNG-Bilder exportieren.',
  reader: 'PDF-Seiten anzeigen, vergrößern und vorhandenen Text durchsuchen.',
  'page-numbers': 'Sichtbare Seitenzahlen zu einer PDF-Kopie hinzufügen.',
  watermark: 'Ein sichtbares Textwasserzeichen in eine PDF-Kopie einfügen.',
  'pdf-to-text': 'Vorhandene Textebenen als TXT exportieren; ohne OCR.',
  'doc-info': 'Seitenzahl, Abmessungen und verfügbare Metadaten prüfen.',
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function germanCatalogHtml(): string {
  const items = TOOLS.filter(tool => tool.implemented).map(tool =>
    '<li><a href="/pdf-tools/' + escapeHtml(tool.route.replace(/^\//, '')) + '/">' +
    escapeHtml(germanTitles[tool.id]) + '</a><p>' +
    escapeHtml(descriptions[tool.id]) +
    ' <small>(Werkzeug derzeit auf Englisch)</small></p></li>',
  ).join('')
  return `<header class="tool-header">
    <p class="fl-eyebrow">KOSTENLOS · OPEN SOURCE</p>
    <h1>PDF-Tools direkt im Browser verwenden</h1>
    <p>Mit PDF Tools kannst du PDFs zusammenfügen, teilen, drehen, lesen und bearbeiten. Die vorhandenen Werkzeuge verarbeiten ausgewählte Dateien auf deinem Gerät. Ein Benutzerkonto ist nicht nötig.</p>
    <p><strong>Wichtiger Hinweis:</strong> Diese deutschsprachige Übersicht führt zu Werkzeugen und Hilfeseiten, die derzeit überwiegend auf Englisch angeboten werden. Weitere deutsche Seiten werden erst nach vollständiger Übersetzung veröffentlicht.</p>
    <p>Beim Laden der Website und ihrer Dateien stellt dein Browser eine Verbindung zu GitHub Pages her. Dokumentinhalte werden für die angebotenen lokalen Werkzeuge nicht an einen Konvertierungsserver hochgeladen.</p>
    <p><a href="/pdf-tools/">English version</a> · <a href="https://github.com/Akshat4112/pdf-tools" rel="noopener noreferrer">Quellcode (MIT-Lizenz)</a></p>
  </header>
  <section aria-labelledby="de-tool-heading">
    <h2 id="de-tool-heading">Verfügbare PDF-Werkzeuge</h2>
    <ul class="hub-tool-list">${items}</ul>
  </section>
  <section aria-labelledby="de-limits-heading">
    <h2 id="de-limits-heading">So funktioniert die Verarbeitung</h2>
    <ol><li>Wähle das passende Werkzeug.</li><li>Öffne Dateien von deinem Gerät und prüfe die Einstellungen.</li><li>Kontrolliere das Ergebnis und speichere die fertige Datei.</li></ol>
    <p>Die üblichen Grenzen liegen bei 50 MiB pro Datei und 300 PDF-Seiten. Einzelne Funktionen haben engere Grenzen. Gescannte Dokumente benötigen für Texterkennung OCR; diese Funktion wird hier nicht angeboten. Änderungen können digitale Signaturen oder interaktive PDF-Inhalte beeinträchtigen. Seiten entfernen ist keine sichere Schwärzung.</p>
    <p>Weitere Informationen (auf Englisch): <a href="/pdf-tools/privacy/">Datenschutzhinweise</a>,
    <a href="/pdf-tools/limitations/">Grenzen der Werkzeuge</a> und
    <a href="/pdf-tools/trust/">Quellcode und technische Nachweise</a>.</p>
    <p>Teile niemals vertrauliche Dokumente in öffentlichen GitHub-Issues.</p>
  </section>`
}
