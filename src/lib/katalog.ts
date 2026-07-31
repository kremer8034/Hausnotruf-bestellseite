/**
 * Produkt- und Preiskatalog.
 *
 * Quelle: BRK_Hausnotruf_Preisuebersicht.xlsx (Preise gültig ab 01.04.2026).
 * Die Werte sind vom Kreisverband als bindend vorgegeben und dürfen nur
 * gemeinsam mit einer neuen Preisliste geändert werden.
 *
 * Beträge in Euro.
 */

export type PaketId =
  | "basispaket"
  | "pflegekassenpaket"
  | "komfortpaket"
  | "assistenzsystem"
  | "mobilrufpaket"
  | "notrufuhr";

export type OptionId =
  | "tagestaste"
  | "servicegarantie"
  | "rauchmelder"
  | "trinkerinnerung";

/** Ankreuzfelder der Leistungsübersicht auf Vertragsseite 2. */
export type LeistungsFeld =
  | "Leistung_HNR"
  | "Leistung_MR_1"
  | "Leistung_MR_2"
  | "Leistung_Tagestaste"
  | "Leistung_Depot"
  | "Leistung_Sensoren"
  | "Leistung_Helfereinsatz"
  | "Leistung_Pauschale"
  | "Leistung_Sonstiges";

export interface Paket {
  id: PaketId;
  name: string;
  einsatzbereich: string;
  beschreibung: string;
  /** Monatlicher Beitrag ohne Kostenübernahme der Pflegekasse. */
  monatlichOhneKue: number | null;
  /** Monatlicher Beitrag mit bewilligter Kostenübernahme. */
  monatlichMitKue: number | null;
  /** Einmalige Organisationspauschale. */
  organisationspauschale: number;
  /** Einmaliger Kaufpreis des Geräts (inkl. MwSt.), falls das Gerät gekauft wird. */
  kaufpreis: number | null;
  inklusivEinsaetze: number;
  einsatzpauschale: number;
  /** Ankreuzfeld der Leistungsart auf Vertragsseite 2. */
  leistungsfeld: Extract<LeistungsFeld, "Leistung_HNR" | "Leistung_MR_1" | "Leistung_MR_2">;
  /** Gerätebezeichnung für Anlage 8/9 (Feld HNR_System). */
  hnrSystem: string;
  /** Braucht das Gerät eine SIM-Karte vom BRK? Steuert Ausstattung_3 auf Seite 2. */
  simKarte: boolean;
}

export const PAKETE: Paket[] = [
  {
    id: "basispaket",
    name: "Basispaket",
    einsatzbereich: "Zu Hause",
    beschreibung:
      "Hausnotrufgerät mit Funksender und Anbindung an die BRK-Notrufzentrale. Ohne Unterstützung der Pflegekasse.",
    monatlichOhneKue: 34,
    monatlichMitKue: null,
    organisationspauschale: 59,
    kaufpreis: null,
    inklusivEinsaetze: 0,
    einsatzpauschale: 89,
    leistungsfeld: "Leistung_HNR",
    hnrSystem: "Hausnotrufsystem Basispaket",
    simKarte: false,
  },
  {
    id: "pflegekassenpaket",
    name: "Pflegekassenpaket",
    einsatzbereich: "Zu Hause",
    beschreibung:
      "Zuzahlungsfreie Grundversorgung. Nur mit bewilligter Kostenübernahme der Pflegekasse möglich.",
    monatlichOhneKue: null,
    monatlichMitKue: 0,
    organisationspauschale: 0,
    kaufpreis: null,
    inklusivEinsaetze: 0,
    einsatzpauschale: 89,
    leistungsfeld: "Leistung_HNR",
    hnrSystem: "Hausnotrufsystem Pflegekassenpaket",
    simKarte: false,
  },
  {
    id: "komfortpaket",
    name: "Komfortpaket",
    einsatzbereich: "Zu Hause",
    beschreibung:
      "Hausnotruf mit Hintergrunddienst: sechs Helfereinsätze pro Jahr sind bereits enthalten.",
    monatlichOhneKue: 56,
    monatlichMitKue: 29,
    organisationspauschale: 59,
    kaufpreis: null,
    inklusivEinsaetze: 6,
    einsatzpauschale: 69,
    leistungsfeld: "Leistung_HNR",
    hnrSystem: "Hausnotrufsystem Komfortpaket",
    simKarte: false,
  },
  {
    id: "assistenzsystem",
    name: "Hausnotruf-Assistenzsystem",
    einsatzbereich: "Zu Hause",
    beschreibung:
      "Komfortleistungen plus Assistenzfunktionen; Trinkerinnerung und CO₂-Ampel ohne Aufpreis enthalten.",
    monatlichOhneKue: 69,
    monatlichMitKue: 42,
    organisationspauschale: 59,
    kaufpreis: null,
    inklusivEinsaetze: 6,
    einsatzpauschale: 69,
    leistungsfeld: "Leistung_HNR",
    hnrSystem: "Hausnotruf-Assistenzsystem",
    simKarte: false,
  },
  {
    id: "mobilrufpaket",
    name: "Mobilrufpaket",
    einsatzbereich: "Zu Hause und unterwegs",
    beschreibung:
      "Hilfe auf Knopfdruck auch außerhalb der Wohnung, mit Ortung im Notfall. Inklusive Hintergrunddienst.",
    monatlichOhneKue: 70,
    monatlichMitKue: 43,
    organisationspauschale: 59,
    kaufpreis: null,
    inklusivEinsaetze: 6,
    einsatzpauschale: 69,
    // ANNAHME (vom Kreisverband zu bestätigen): Mobilruf mit Ortung.
    leistungsfeld: "Leistung_MR_2",
    hnrSystem: "Mobilrufsystem mit Ortung",
    simKarte: true,
  },
  {
    id: "notrufuhr",
    name: "Notrufuhr",
    einsatzbereich: "Unterwegs (ggf. zu Hause)",
    beschreibung:
      "Notrufuhr zum Tragen am Handgelenk. Das Gerät wird gekauft, die Leistung monatlich abgerechnet.",
    monatlichOhneKue: 59,
    monatlichMitKue: null,
    organisationspauschale: 79,
    kaufpreis: 189,
    inklusivEinsaetze: 6,
    einsatzpauschale: 69,
    // ANNAHME (vom Kreisverband zu bestätigen): Mobilruf ohne Ortung.
    leistungsfeld: "Leistung_MR_1",
    hnrSystem: "Notrufuhr",
    simKarte: true,
  },
];

export interface Zusatzoption {
  id: OptionId;
  name: string;
  monatlich: number;
  hinweis: string;
  /** Pakete, bei denen die Option buchbar ist. */
  buchbarBei: PaketId[];
  /** Option ist im Paket enthalten und nicht abwählbar. */
  immerEnthalten?: boolean;
  leistungsfeld?: LeistungsFeld;
}

export const ZUSATZOPTIONEN: Zusatzoption[] = [
  {
    id: "tagestaste",
    name: "Tagestaste (Lebenszeichenfunktion)",
    monatlich: 3,
    hinweis:
      "Timer im Gerät: Wird die Taste nicht innerhalb von 24 Stunden gedrückt, löst das Gerät selbstständig einen Notruf aus.",
    buchbarBei: ["komfortpaket", "assistenzsystem"],
    leistungsfeld: "Leistung_Tagestaste",
  },
  {
    id: "servicegarantie",
    name: "Servicegarantie",
    monatlich: 8,
    hinweis:
      "Schlüsseltausch, Umzug des Geräts, Serviceöffnung bei Aussperrung, Ersatz von Handsender und Zubehör.",
    buchbarBei: [
      "basispaket",
      "pflegekassenpaket",
      "komfortpaket",
      "assistenzsystem",
      "mobilrufpaket",
    ],
    leistungsfeld: "Leistung_Sonstiges",
  },
  {
    id: "rauchmelder",
    name: "Rauchmelder",
    monatlich: 7.5,
    hinweis:
      "Aufschaltung zur BRK-Service- und Notrufzentrale. Die Installation erfolgt durch den Teilnehmer selbst.",
    buchbarBei: ["pflegekassenpaket", "basispaket", "komfortpaket"],
    leistungsfeld: "Leistung_Sensoren",
  },
  {
    id: "trinkerinnerung",
    name: "Trinkerinnerung und CO₂-Ampel",
    monatlich: 0,
    hinweis: "Ohne Aufpreis im Assistenzsystem enthalten.",
    buchbarBei: ["assistenzsystem"],
    immerEnthalten: true,
  },
];

/** In allen Paketen enthalten – wird auf der Bestellseite als Zugabe ausgewiesen. */
export const IMMER_ENTHALTEN = [
  "Rotkreuz-Dose für die wichtigsten Notfalldaten",
  "Betreuungsanruf nach etwa vier Wochen",
  "Gutschein für einen Erste-Hilfe-Kurs",
];

/** Rabatt für VdK-Mitglieder laut Kooperationsvereinbarung BRK/VdK (Anlage 12). */
export const VDK_RABATT_PROZENT = 7;

export function paketById(id: PaketId): Paket {
  const paket = PAKETE.find((p) => p.id === id);
  if (!paket) throw new Error(`Unbekanntes Paket: ${id}`);
  return paket;
}

export function optionById(id: OptionId): Zusatzoption {
  const option = ZUSATZOPTIONEN.find((o) => o.id === id);
  if (!option) throw new Error(`Unbekannte Option: ${id}`);
  return option;
}

export function optionenFuerPaket(paketId: PaketId): Zusatzoption[] {
  return ZUSATZOPTIONEN.filter((o) => o.buchbarBei.includes(paketId));
}

/** Pakete, die ohne Pflegegrad bzw. ohne beantragte Kostenübernahme wählbar sind. */
export function paketeOhneKostenuebernahme(): Paket[] {
  return PAKETE.filter((p) => p.monatlichOhneKue !== null);
}

/** Pakete, die mit Kostenübernahme der Pflegekasse wählbar sind. */
export function paketeMitKostenuebernahme(): Paket[] {
  return PAKETE.filter((p) => p.monatlichMitKue !== null);
}
