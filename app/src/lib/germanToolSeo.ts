import type { ToolId } from '../registry'

/**
 * PT-SEO-010 translation inventory for shipped German tool landing pages.
 *
 * Content is editorial copy only, not proof that a /de/<tool>/ route exists.
 * DO NOT add these URLs to a sitemap or hreflang until translated workflows,
 * direct-load HTML, accessible navigation and legal disclosures are reviewed.
 * Never interpolate selected filenames, metadata or PDF contents.
 */
export interface GermanToolSeoCopy {
  title: string
  heading: string
  description: string
  steps: readonly [string, string, string]
  limitation: string
}

export const GERMAN_TOOL_SEO: Readonly<Record<ToolId, GermanToolSeoCopy>> = {
  merge: {
    title: 'PDFs kostenlos zusammenfügen — PDF Tools',
    heading: 'PDF-Dateien zusammenfügen',
    description: 'Füge mehrere PDF-Dateien in deiner Reihenfolge zu einem Dokument zusammen. Kostenlos im Browser, ohne Benutzerkonto.',
    steps: ['PDF-Dateien auswählen und ihre Reihenfolge prüfen.', 'Dateien im Browser zusammenfügen.', 'Neue PDF-Datei prüfen und herunterladen.'],
    limitation: 'Interaktive Formulare und digitale Signaturen können durch das Zusammenfügen verändert oder ungültig werden.',
  },
  split: {
    title: 'PDF-Datei kostenlos teilen — PDF Tools',
    heading: 'PDF in mehrere Dateien aufteilen',
    description: 'Teile ein PDF nach Seitenbereichen, in gleich große Abschnitte oder in einzelne Seiten. Lokal im Browser.',
    steps: ['PDF auswählen und Seitenumfang prüfen.', 'Seitenbereiche oder gewünschte Aufteilung festlegen.', 'Ergebnis als ZIP-Datei speichern.'],
    limitation: 'Das Teilen entfernt keine vertraulichen Informationen aus den verbleibenden Seiten.',
  },
  rotate: {
    title: 'PDF-Seiten kostenlos drehen — PDF Tools',
    heading: 'PDF-Seiten drehen',
    description: 'Drehe ausgewählte PDF-Seiten in 90-Grad-Schritten und speichere eine neue Kopie direkt im Browser.',
    steps: ['PDF auswählen und Seiten anzeigen.', 'Zu drehende Seiten und Winkel festlegen.', 'Vorschau kontrollieren und PDF-Kopie speichern.'],
    limitation: 'Eine neu gespeicherte PDF-Datei kann vorhandene digitale Signaturen ungültig machen.',
  },
  'delete-pages': {
    title: 'PDF-Seiten entfernen — PDF Tools',
    heading: 'Seiten aus einem PDF entfernen',
    description: 'Entferne ganze Seiten aus einer PDF-Kopie, prüfe die Auswahl und lade das Ergebnis kostenlos herunter.',
    steps: ['PDF auswählen und Seitenübersicht öffnen.', 'Zu entfernende Seiten markieren und Auswahl prüfen.', 'Neue PDF-Kopie erstellen und kontrollieren.'],
    limitation: 'Seiten entfernen ist keine sichere Schwärzung. Inhalte können an anderer Stelle im Dokument verbleiben.',
  },
  'extract-pages': {
    title: 'PDF-Seiten kostenlos extrahieren — PDF Tools',
    heading: 'Ausgewählte PDF-Seiten extrahieren',
    description: 'Wähle bestimmte PDF-Seiten aus und speichere sie in einer neuen Datei, kostenlos und im Browser.',
    steps: ['PDF auswählen und Seiten ansehen.', 'Gewünschte Seiten und Reihenfolge festlegen.', 'Neue Datei erstellen, prüfen und speichern.'],
    limitation: 'Nicht ausgewählte Seiten werden nicht übernommen. Das Ergebnis ist keine Datenschutzprüfung oder Schwärzung.',
  },
  organize: {
    title: 'PDF-Seiten sortieren und organisieren — PDF Tools',
    heading: 'PDF-Seiten neu anordnen',
    description: 'Sortiere, drehe, dupliziere oder entferne PDF-Seiten. Prüfe das Ergebnis und speichere eine neue Datei.',
    steps: ['PDF auswählen und Seitenvorschau prüfen.', 'Seiten verschieben, drehen, kopieren oder entfernen.', 'Änderungen kontrollieren und eine neue Kopie erstellen.'],
    limitation: 'Interaktive Inhalte, Lesezeichen oder digitale Signaturen bleiben beim Umschreiben möglicherweise nicht erhalten.',
  },
  'images-to-pdf': {
    title: 'JPG und PNG in PDF umwandeln — PDF Tools',
    heading: 'Bilder in eine PDF-Datei umwandeln',
    description: 'Füge JPG- oder PNG-Bilder zu einem PDF zusammen. Wähle Reihenfolge, Seitengröße und Ränder im Browser.',
    steps: ['JPG- oder PNG-Bilder auswählen.', 'Reihenfolge, Seitengröße und Anpassung festlegen.', 'Vorschau prüfen und PDF speichern.'],
    limitation: 'Die Bilder werden als Seiten eingebettet; dadurch entsteht nicht automatisch durchsuchbarer Text.',
  },
  'pdf-to-jpg': {
    title: 'PDF-Seiten in JPG umwandeln — PDF Tools',
    heading: 'PDF als JPG-Bilder exportieren',
    description: 'Exportiere ausgewählte PDF-Seiten als JPG-Bilder mit wählbarer Qualität und Auflösung, direkt im Browser.',
    steps: ['PDF auswählen und Seiten bestimmen.', 'Bildauflösung und JPG-Qualität einstellen.', 'Bilder einzeln oder als ZIP herunterladen.'],
    limitation: 'JPG enthält Pixel statt durchsuchbarem PDF-Text; einzelne eingebettete Originalbilder werden nicht separat extrahiert.',
  },
  'pdf-to-png': {
    title: 'PDF-Seiten in PNG umwandeln — PDF Tools',
    heading: 'PDF als PNG-Bilder exportieren',
    description: 'Wandle PDF-Seiten in PNG-Bilder mit weißem oder transparentem Hintergrund um. Kostenlos im Browser.',
    steps: ['PDF auswählen und gewünschte Seiten markieren.', 'Auflösung und Hintergrund festlegen.', 'PNG-Dateien einzeln oder im ZIP speichern.'],
    limitation: 'Die exportierten PNG-Dateien enthalten gerenderte Seitenbilder, keine durchsuchbare PDF-Textebene.',
  },
  reader: {
    title: 'PDF kostenlos im Browser lesen — PDF Tools',
    heading: 'PDF-Dateien im Browser lesen',
    description: 'Lies PDFs, zoome und durchsuche vorhandenen Text direkt im Browser, ohne Benutzerkonto.',
    steps: ['PDF von deinem Gerät öffnen.', 'Seiten wechseln, zoomen und vorhandenen Text suchen.', 'Bei Bedarf Text kopieren oder Dokument drucken.'],
    limitation: 'Gescannten Bildseiten fehlt häufig eine Textebene. Die Lesefunktion bietet keine OCR-Texterkennung.',
  },
  'page-numbers': {
    title: 'PDF mit Seitenzahlen versehen — PDF Tools',
    heading: 'Seitenzahlen in PDF einfügen',
    description: 'Füge sichtbare Seitenzahlen zu ausgewählten PDF-Seiten hinzu. Startnummer und Position selbst bestimmen.',
    steps: ['PDF auswählen und Zielseiten festlegen.', 'Startnummer und Position auswählen.', 'Vorschau prüfen und neue Datei speichern.'],
    limitation: 'Sichtbare Seitenzahlen ändern nicht automatisch die internen PDF-Seitenlabels oder Lesezeichen.',
  },
  watermark: {
    title: 'Textwasserzeichen in PDF einfügen — PDF Tools',
    heading: 'PDF mit Wasserzeichen versehen',
    description: 'Setze ein Textwasserzeichen mit wählbarer Position und Deckkraft auf PDF-Seiten. Direkt im Browser.',
    steps: ['PDF auswählen und Wasserzeichentext eingeben.', 'Position, Deckkraft und Seiten bestimmen.', 'Vorschau prüfen und bearbeitete Kopie speichern.'],
    limitation: 'Ein Wasserzeichen ist weder Zugriffsschutz noch sichere Schwärzung; darunterliegende Inhalte bleiben erhalten.',
  },
  'pdf-to-text': {
    title: 'Text aus PDF exportieren — PDF Tools',
    heading: 'Vorhandenen PDF-Text exportieren',
    description: 'Exportiere die vorhandene Textebene einer PDF-Datei als UTF-8-TXT. Kostenlos im Browser, ohne OCR.',
    steps: ['PDF mit auswählbarem Text öffnen.', 'Textexport im Browser starten.', 'TXT-Datei herunterladen und Inhalt prüfen.'],
    limitation: 'Gescannten Bildseiten fehlt häufig eine Textebene. OCR und Layout-Erhaltung werden nicht angeboten.',
  },
  'doc-info': {
    title: 'PDF-Dokumentinformationen prüfen — PDF Tools',
    heading: 'Metadaten und Seiten eines PDF prüfen',
    description: 'Sieh dir PDF-Metadaten, Seitenzahlen, Abmessungen und Dokumenthinweise an, ohne die Datei umzuschreiben.',
    steps: ['PDF von deinem Gerät auswählen.', 'Dokumentinformationen im Browser prüfen.', 'Hinweise und mögliche Einschränkungen berücksichtigen.'],
    limitation: 'Metadaten können fehlen oder unzuverlässig sein. Signaturhinweise bestätigen keine Echtheit oder Zertifikatsgültigkeit.',
  },
}
