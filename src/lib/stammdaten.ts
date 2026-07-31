/**
 * Stammdaten des Kreisverbands.
 *
 * Diese Werte landen auf nahezu jeder Vertragsseite. Sie sind im Backoffice
 * pflegbar; die Werte hier sind die Startbelegung beim ersten Hochfahren.
 *
 * PLATZHALTER: verbandsNummer, ik, glaeubigerId und impressumUrl sind vom
 * Kreisverband noch nicht geliefert und vor dem Echtbetrieb zu ersetzen.
 */

export interface Stammdaten {
  verbandsName: string;
  verbandsAnschrift: string;
  vertretenDurch: string;
  telefon: string;
  fax: string;
  email: string;
  /** Empfänger der abgeschlossenen Verträge im Backoffice. */
  backofficeEmail: string;
  /** Feld KV_Nummer im Vertrag ist die Versichertennummer – hier nicht benötigt. */
  ik: string;
  glaeubigerId: string;
  /** Vorabinformationsfrist der SEPA-Lastschrift in Tagen. */
  sepaFristTage: string;
  datenschutzbeauftragter: string;
  aufsichtsbehoerde: string;
  hausnotrufbeauftragter: string;
  impressumUrl: string;
  /** Region für Mobilruf-Pakete (Vertragsseite 5, Teil 5). */
  mobilrufRegion: string;
  /** Vorbelegung der Schweigepflichtentbindung (Anlage 6, sieben Zeilen). */
  schweigepflichtentbindung: string[];
}

export const STAMMDATEN_STANDARD: Stammdaten = {
  verbandsName: "BRK-Kreisverband Miltenberg-Obernburg",
  verbandsAnschrift: "Römerstraße 93, 63785 Obernburg",
  vertretenDurch: "Uwe Eisner, Kreisgeschäftsführer",
  telefon: "06022 6181-0",
  fax: "",
  email: "info.mil@brk.de",
  backofficeEmail: "hausnotruf.mil@brk.de",
  ik: "269999999", // PLATZHALTER – echte 9-stellige IK-Nummer nachtragen
  glaeubigerId: "DE66ZZZ06666666666", // PLATZHALTER
  sepaFristTage: "5",
  datenschutzbeauftragter: "Martin Plomitzer, 06022 6181-0, info.mil@brk.de",
  aufsichtsbehoerde:
    "Bayerisches Landesamt für Datenschutzaufsicht, Promenade 27, 91522 Ansbach",
  hausnotrufbeauftragter: "Daniel Zimmermann, Hausnotrufbeauftragter, 06022 6181-0",
  impressumUrl: "https://www.kvmiltenberg.brk.de/impressum", // PLATZHALTER
  mobilrufRegion: "Deutschland",
  schweigepflichtentbindung: [
    "Rettungsdienst und Notarzt",
    "Behandelnde Ärztinnen und Ärzte",
    "Krankenhäuser",
    "Pflegedienst",
    "Die im Datenblatt benannten Kontaktpersonen",
    "Pflegekasse",
    "Betreuende Angehörige",
  ],
};
