/** Datenmodell einer Bestellung. Spiegelt die Felder des BRK-Servicevertrags. */

import { OptionId, PaketId } from "./katalog";

export type Anrede = "Frau" | "Herr" | "Divers";
export type Pflegegrad = "ohne" | "1" | "2" | "3" | "4" | "5";
export type Anschlussart = "gsm" | "voip" | "msan";

export const BEZUGSARTEN = [
  "Ehemann/Ehefrau",
  "Sohn/Tochter",
  "Sonstige Angehörige",
  "Nachbar/-in, Bekannte",
  "Pflegedienst/Betreuer/-in",
  "Hausarzt/Hausärztin",
  "Rettungswache/Depot",
] as const;
export type Bezugsart = (typeof BEZUGSARTEN)[number];

export interface Person {
  anrede: Anrede;
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
}

export interface Kontaktperson {
  name: string;
  bezugsart: Bezugsart;
  telefon: string;
  anschrift: string;
  schluesselVorhanden: boolean;
}

export interface Bestellung {
  /** Bestellt der Teilnehmer selbst oder ein Angehöriger für ihn? */
  bestellerIstTeilnehmer: boolean;
  /** Nur gesetzt, wenn ein Angehöriger bestellt. Diese Person unterschreibt. */
  besteller?: {
    anrede: Anrede;
    vorname: string;
    nachname: string;
    telefon: string;
    email: string;
    /** Bestätigung, für den Teilnehmer handeln zu dürfen. */
    bevollmaechtigt: boolean;
  };

  teilnehmer: Person & { geburtsdatum: string };

  /** Pflegegrad und Kostenträger. */
  pflegegrad: Pflegegrad;
  /** Kostenübernahme bei der Pflegekasse beantragen. Setzt einen Pflegegrad voraus. */
  kostenuebernahme: boolean;
  pflegekasseName: string;
  pflegekasseAnschrift: string;
  versichertennummer: string;
  /** Antragsgründe auf Anlage 8, Mehrfachnennung möglich. */
  grundAlleinlebend: boolean;
  grundNotsituation: boolean;

  /** Gewähltes Paket und Zusatzoptionen. */
  paketId: PaketId;
  optionen: OptionId[];

  /** Technischer Anschluss beim Teilnehmer. */
  anschlussart: Anschlussart;
  telefonanbieter: string;
  geraeteRufnummer: string;

  kontaktpersonen: Kontaktperson[];

  /**
   * Wunsch, wo der Schlüsseltresor angebracht werden soll. Angebracht wird er
   * vom Techniker vor Ort; der Kreisverband bewahrt keine Schlüssel auf.
   */
  keySafeStandortWunsch: string;
  /** Weitere Hinweise zum Wohnungszugang (Klingelschild, Stockwerk, Hund …). */
  zugangshinweise: string;

  hausarztName: string;
  hausarztTelefon: string;
  /** Weitere Informationen für die Notrufzentrale (Vertragsseite 5, Teil 6). */
  notfallhinweise: string;

  vdkMitglied: boolean;
  vdkMitgliedsnummer: string;

  /** SEPA-Basislastschriftmandat. */
  zahlungspflichtigerIstTeilnehmer: boolean;
  sepaKontoinhaber: string;
  sepaAnschrift: string;
  sepaIban: string;
  sepaBic: string;
  sepaBank: string;

  /** Bestätigungen der Zusammenfassungsseite (Vertragsseite 27). */
  bestaetigungen: Bestaetigungen;

  /** Unterschrift als PNG-Data-URL, vom Unterschriftenfeld erzeugt. */
  unterschrift: string;
  unterschriftOrt: string;
}

export interface Bestaetigungen {
  leistungenUndGeraete: boolean;
  kosten: boolean;
  hinweisePunkt4und5: boolean;
  datenblatt: boolean;
  schluesselAushaendigung: boolean;
  empfangsberechtigte: boolean;
  sepaMandat: boolean;
  widerrufsbelehrung: boolean;
  sofortigeErbringung: boolean;
  schweigepflichtentbindung: boolean;
  gesundheitsdaten: boolean;
  vdk: boolean;
  vollmachtPflegekasse: boolean;
  /** Zusätzlich zur Vertragsseite: AGB und Datenschutzhinweise. */
  agb: boolean;
  datenschutz: boolean;
}

/** Vom Techniker vor Ort erfasste Angaben. */
export interface VorOrtErfassung {
  /** Anlage 1 Teil 2: Mietgeräte mit ID/SIM, bis zu fünf Zeilen. */
  mietgeraete: { bezeichnung: string; idNummer: string }[];
  technischeVoraussetzungen: string;
  /** Anlage 11: Gesundheitsdaten. */
  gesundheit: Gesundheitsdaten;
  /** Anlage 9: Inbetriebnahme. */
  datumInbetriebnahme: string;
  vorgangsnummer: string;
  versorgungAb: string;
  anwesendVertreter: boolean;
  anwesendBetreuer: boolean;
  anwesendSonstige: boolean;
  ortInbetriebnahme: string;
  /** Unterschrift des BRK-Mitarbeitenden (Inbetriebnahme). */
  unterschriftLeistungserbringer: string;
  /** Unterschrift des Teilnehmers (Empfangs- und Einweisungsbestätigung). */
  unterschriftTeilnehmer: string;
  /** Kaufbeleg, nur bei Paketen mit Gerätekauf. */
  kaufGeraete: { bezeichnung: string; seriennummer: string; kosten: string }[];
}

export interface Gesundheitsdaten {
  koerperlich: string[];
  geistig: string[];
  anmerkungKoerperlich: string;
  anmerkungGeistig: string;
  medikamente: string;
  medikamentenallergien: string;
}

/** Bearbeitungsstatus eines Vertrags im Backoffice. */
export const VERTRAGS_STATUS = [
  "neu",
  "kasse_beantragt",
  "kasse_genehmigt",
  "installiert",
  "gekuendigt",
] as const;
export type VertragsStatus = (typeof VERTRAGS_STATUS)[number];

export const STATUS_LABEL: Record<VertragsStatus, string> = {
  neu: "Neu",
  kasse_beantragt: "Kasse beantragt",
  kasse_genehmigt: "Kasse genehmigt",
  installiert: "Installiert",
  gekuendigt: "Gekündigt",
};

/** Schritte der Kundenstrecke – Grundlage der Trichteransicht. */
export const SCHRITTE = [
  "start",
  "paket",
  "teilnehmer",
  "kostentraeger",
  "anschluss",
  "kontaktpersonen",
  "zugang",
  "zahlung",
  "zusammenfassung",
  "abgeschlossen",
] as const;
export type Schritt = (typeof SCHRITTE)[number];

export const SCHRITT_LABEL: Record<Schritt, string> = {
  start: "Startseite / Preisrechner",
  paket: "Paketauswahl",
  teilnehmer: "Angaben zur Person",
  kostentraeger: "Pflegegrad und Kostenträger",
  anschluss: "Technischer Anschluss",
  kontaktpersonen: "Kontaktpersonen",
  zugang: "Wohnungszugang und Notfallinfos",
  zahlung: "Bankverbindung",
  zusammenfassung: "Zusammenfassung und Unterschrift",
  abgeschlossen: "Vertrag abgeschlossen",
};
