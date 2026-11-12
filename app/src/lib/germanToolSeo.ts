import type { ToolId } from '../registry.ts'

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

/** The first released tool's metadata can load without the future tool inventory. */
export const GERMAN_MERGE_COPY: GermanToolSeoCopy = {
    title: 'PDFs kostenlos zusammenfügen — PDF Tools',
    heading: 'PDF-Dateien zusammenfügen',
    description: 'Füge mehrere PDF-Dateien in deiner Reihenfolge zu einem Dokument zusammen. Kostenlos im Browser, ohne Benutzerkonto.',
    steps: ['PDF-Dateien auswählen und ihre Reihenfolge prüfen.', 'Dateien im Browser zusammenfügen.', 'Neue PDF-Datei prüfen und herunterladen.'],
    limitation: 'Interaktive Formulare und digitale Signaturen können durch das Zusammenfügen verändert oder ungültig werden.',
}

/** Keep shipped Split metadata independent of the remaining translation inventory. */
export const GERMAN_SPLIT_COPY: GermanToolSeoCopy = {
    title: 'PDF-Datei kostenlos teilen — PDF Tools',
    heading: 'PDF in mehrere Dateien aufteilen',
    description: 'Teile ein PDF nach Seitenbereichen, in gleich große Abschnitte oder in einzelne Seiten. Lokal im Browser.',
    steps: ['PDF auswählen und Seitenumfang prüfen.', 'Seitenbereiche oder gewünschte Aufteilung festlegen.', 'Ergebnis als ZIP-Datei speichern.'],
    limitation: 'Das Teilen entfernt keine vertraulichen Informationen aus den verbleibenden Seiten.',
}

/** Keep the shipped Rotate page out of the unpublished tool SEO inventory. */
export const GERMAN_ROTATE_COPY: GermanToolSeoCopy = {
    title: 'PDF-Seiten kostenlos drehen — PDF Tools',
    heading: 'PDF-Seiten drehen',
    description: 'Drehe ausgewählte PDF-Seiten in 90-Grad-Schritten und speichere eine neue Kopie direkt im Browser.',
    steps: ['PDF auswählen und Seiten anzeigen.', 'Zu drehende Seiten und Winkel festlegen.', 'Vorschau kontrollieren und PDF-Kopie speichern.'],
    limitation: 'Eine neu gespeicherte PDF-Datei kann vorhandene digitale Signaturen ungültig machen.',
  }

/** Reviewed Delete Pages copy; importing this alone does not pull the unpublished inventory. */
export const GERMAN_DELETE_COPY: GermanToolSeoCopy = {
  title: 'PDF-Seiten entfernen — PDF Tools',
  heading: 'Seiten aus einem PDF entfernen',
  description: 'Entferne ganze Seiten aus einer PDF-Kopie, prüfe die Auswahl und lade das Ergebnis kostenlos herunter.',
  steps: ['PDF auswählen und Seitenübersicht öffnen.', 'Zu entfernende Seiten markieren und Auswahl prüfen.', 'Neue PDF-Kopie erstellen und kontrollieren.'],
  limitation: 'Seiten entfernen ist keine sichere Schwärzung. Inhalte können an anderer Stelle im Dokument verbleiben.',
}

/** Released Extract Pages metadata isolated from the untranslated inventory. */
export const GERMAN_EXTRACT_COPY: GermanToolSeoCopy = {
  title: 'PDF-Seiten kostenlos extrahieren — PDF Tools',
  heading: 'Ausgewählte PDF-Seiten extrahieren',
  description: 'Extrahiere ausgewählte PDF-Seiten kostenlos in eine neue Datei, direkt im Browser.',
  steps: ['PDF auswählen und Seiten prüfen.', 'Seiten markieren und Reihenfolge prüfen.', 'Neue PDF-Datei prüfen und speichern.'],
  limitation: 'Nicht ausgewählte Seiten werden nicht übernommen. Das Ergebnis ist keine Datenschutzprüfung oder Schwärzung.',
}

/** Published Organize copy, kept separate from the unpublished tool inventory. */
export const GERMAN_ORGANIZE_COPY: GermanToolSeoCopy = {
  title: 'PDF-Seiten kostenlos organisieren — PDF Tools',
  heading: 'PDF-Seiten organisieren',
  description: 'Sortiere, drehe, dupliziere oder entferne PDF-Seiten und speichere eine neue Kopie im Browser.',
  steps: ['PDF öffnen und Seitenvorschau prüfen.', 'Seiten sortieren, drehen, duplizieren oder entfernen.', 'Änderungen und Ausgabereihenfolge prüfen, Kopie speichern.'],
  limitation: 'Digitale Signaturen können ungültig werden. Seiten entfernen ist keine sichere Schwärzung.',
}

/** Reviewed Images-to-PDF copy independent from future tool localization. */
export const GERMAN_IMAGES_TO_PDF_COPY: GermanToolSeoCopy = {
  title: 'Bilder kostenlos in PDF umwandeln — PDF Tools',
  heading: 'JPG und PNG in PDF umwandeln',
  description: 'Füge JPG- oder PNG-Bilder zu einer PDF-Datei zusammen und wähle Format, Anpassung und Ränder direkt im Browser.',
  steps: ['JPG- oder PNG-Bilder auswählen und sortieren.', 'Seitengröße, Ausrichtung, Anpassung und Ränder einstellen.', 'Vorschau prüfen und PDF-Kopie herunterladen.'],
  limitation: 'Bilder werden als Seiten eingebettet, ohne automatische Texterkennung. Transparente Bildbereiche werden weiß dargestellt.',
}

export const GERMAN_TOOL_SEO: Readonly<Record<ToolId, GermanToolSeoCopy>> = {
  merge: GERMAN_MERGE_COPY,
  split: GERMAN_SPLIT_COPY,
  rotate: GERMAN_ROTATE_COPY,
  'delete-pages': GERMAN_DELETE_COPY,
  'extract-pages': GERMAN_EXTRACT_COPY,
  organize: GERMAN_ORGANIZE_COPY,
  'images-to-pdf': GERMAN_IMAGES_TO_PDF_COPY,
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
