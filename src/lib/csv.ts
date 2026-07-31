/**
 * CSV-Export der Verträge.
 *
 * Eine Zeile je Vertrag mit allen erfassten Angaben, damit die Daten in
 * anderen Systemen weiterverarbeitet werden können. Trennzeichen ist das
 * Semikolon und die Datei beginnt mit einem BOM – so öffnet Excel sie
 * ohne Importdialog und mit korrekten Umlauten.
 */

import { paketById, optionById, PaketId, OptionId } from "./katalog";
import { euroPdf } from "./preis";
import { Bestellung, STATUS_LABEL, VertragsStatus, VorOrtErfassung } from "./typen";

export interface VertragsZeile {
  vorgangsnummer: string;
  vertragsnummer: string | null;
  status: VertragsStatus;
  erstellt_am: string;
  unterschrift_zeit: string | null;
  unterschrift_ip: string | null;
  vor_ort_am: string | null;
  daten: Bestellung;
  vor_ort: VorOrtErfassung | null;
  preis: {
    summe: { monatlich: number; einmalig: number; jaehrlich: number };
    kostenErstesJahr: number;
  };
}

type Spalte = [string, (z: VertragsZeile) => string];

const datum = (wert: string | null) =>
  wert ? new Date(wert).toLocaleString("de-DE") : "";

const jaNein = (wert: boolean | undefined) => (wert ? "ja" : "nein");

const SPALTEN: Spalte[] = [
  ["Vertragsnummer", (z) => z.vertragsnummer ?? ""],
  ["Vorgangsnummer", (z) => z.vorgangsnummer],
  ["Status", (z) => STATUS_LABEL[z.status]],
  ["Vertragsabschluss", (z) => datum(z.erstellt_am)],
  ["Unterschrift am", (z) => datum(z.unterschrift_zeit)],
  ["Unterschrift IP", (z) => z.unterschrift_ip ?? ""],

  ["Anrede Teilnehmer", (z) => z.daten.teilnehmer.anrede],
  ["Vorname Teilnehmer", (z) => z.daten.teilnehmer.vorname],
  ["Nachname Teilnehmer", (z) => z.daten.teilnehmer.nachname],
  ["Geburtsdatum", (z) => z.daten.teilnehmer.geburtsdatum],
  ["Strasse", (z) => z.daten.teilnehmer.strasse],
  ["PLZ", (z) => z.daten.teilnehmer.plz],
  ["Ort", (z) => z.daten.teilnehmer.ort],
  ["Telefon Teilnehmer", (z) => z.daten.teilnehmer.telefon],
  ["E-Mail Teilnehmer", (z) => z.daten.teilnehmer.email],

  ["Bestellt durch Angehoerige", (z) => jaNein(!z.daten.bestellerIstTeilnehmer)],
  ["Besteller Anrede", (z) => z.daten.besteller?.anrede ?? ""],
  ["Besteller Vorname", (z) => z.daten.besteller?.vorname ?? ""],
  ["Besteller Nachname", (z) => z.daten.besteller?.nachname ?? ""],
  ["Besteller Telefon", (z) => z.daten.besteller?.telefon ?? ""],
  ["Besteller E-Mail", (z) => z.daten.besteller?.email ?? ""],

  ["Pflegegrad", (z) => (z.daten.pflegegrad === "ohne" ? "" : z.daten.pflegegrad)],
  ["Kostenuebernahme beantragt", (z) => jaNein(z.daten.kostenuebernahme)],
  ["Pflegekasse", (z) => z.daten.pflegekasseName],
  ["Pflegekasse Anschrift", (z) => z.daten.pflegekasseAnschrift],
  ["Versichertennummer", (z) => z.daten.versichertennummer],
  ["Grund alleinlebend", (z) => jaNein(z.daten.grundAlleinlebend)],
  ["Grund Notsituation", (z) => jaNein(z.daten.grundNotsituation)],

  ["Paket", (z) => paketName(z.daten.paketId)],
  ["Zusatzleistungen", (z) => z.daten.optionen.map(optionName).join(", ")],
  ["Beitrag monatlich", (z) => euroPdf(z.preis.summe.monatlich)],
  ["Kosten einmalig", (z) => euroPdf(z.preis.summe.einmalig)],
  ["Kosten erstes Jahr", (z) => euroPdf(z.preis.kostenErstesJahr)],
  ["VdK-Mitglied", (z) => jaNein(z.daten.vdkMitglied)],
  ["VdK-Mitgliedsnummer", (z) => z.daten.vdkMitgliedsnummer],

  ["Anschlussart", (z) => anschlussName(z.daten.anschlussart)],
  ["Telefonanbieter", (z) => z.daten.telefonanbieter],
  ["Rufnummer Geraet", (z) => z.daten.geraeteRufnummer],

  ...kontaktSpalten(1),
  ...kontaktSpalten(2),
  ...kontaktSpalten(3),
  ...kontaktSpalten(4),

  ["Schluesseltresor Standort", (z) => z.daten.keySafeStandortWunsch],
  ["Zugangshinweise", (z) => z.daten.zugangshinweise],
  ["Hausarzt", (z) => z.daten.hausarztName],
  ["Hausarzt Telefon", (z) => z.daten.hausarztTelefon],
  ["Hinweise Notrufzentrale", (z) => z.daten.notfallhinweise],

  ["Kontoinhaber", (z) => z.daten.sepaKontoinhaber],
  ["Anschrift Kontoinhaber", (z) => z.daten.sepaAnschrift],
  ["IBAN", (z) => z.daten.sepaIban],
  ["BIC", (z) => z.daten.sepaBic],
  ["Kreditinstitut", (z) => z.daten.sepaBank],
  ["Mandatsreferenz", (z) => z.vorgangsnummer],

  ["Vor Ort erfasst am", (z) => datum(z.vor_ort_am)],
  [
    "Geraete",
    (z) =>
      (z.vor_ort?.mietgeraete ?? [])
        .filter((g) => g.bezeichnung)
        .map((g) => `${g.bezeichnung} (${g.idNummer})`)
        .join(", "),
  ],
  ["Inbetriebnahme", (z) => z.vor_ort?.datumInbetriebnahme ?? ""],
  [
    "Gesundheit koerperlich",
    (z) => (z.vor_ort?.gesundheit.koerperlich ?? []).join(", "),
  ],
  ["Gesundheit geistig", (z) => (z.vor_ort?.gesundheit.geistig ?? []).join(", ")],
  ["Medikamente", (z) => z.vor_ort?.gesundheit.medikamente ?? ""],
  ["Medikamentenallergien", (z) => z.vor_ort?.gesundheit.medikamentenallergien ?? ""],
];

function kontaktSpalten(nummer: number): Spalte[] {
  const index = nummer - 1;
  return [
    [`Kontakt ${nummer} Name`, (z) => z.daten.kontaktpersonen[index]?.name ?? ""],
    [`Kontakt ${nummer} Beziehung`, (z) => z.daten.kontaktpersonen[index]?.bezugsart ?? ""],
    [`Kontakt ${nummer} Telefon`, (z) => z.daten.kontaktpersonen[index]?.telefon ?? ""],
    [`Kontakt ${nummer} Anschrift`, (z) => z.daten.kontaktpersonen[index]?.anschrift ?? ""],
    [
      `Kontakt ${nummer} Schluessel`,
      (z) =>
        z.daten.kontaktpersonen[index]
          ? jaNein(z.daten.kontaktpersonen[index].schluesselVorhanden)
          : "",
    ],
  ];
}

function paketName(id: string): string {
  try {
    return paketById(id as PaketId).name;
  } catch {
    return id;
  }
}

function optionName(id: string): string {
  try {
    return optionById(id as OptionId).name;
  } catch {
    return id;
  }
}

function anschlussName(art: string): string {
  return (
    {
      gsm: "GSM",
      voip: "VoIP",
      msan: "MSAN-POTS",
      unbekannt: "noch offen",
    }[art] ?? art
  );
}

/** Setzt einen Wert so, dass Semikolon, Anführungszeichen und Umbrüche halten. */
function feld(wert: string): string {
  const text = (wert ?? "").replace(/\r?\n/g, " ").trim();
  // Führende Sonderzeichen könnte Excel als Formel auswerten.
  const entschaerft = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${entschaerft.replace(/"/g, '""')}"`;
}

export function alsCsv(zeilen: VertragsZeile[]): string {
  const kopf = SPALTEN.map(([name]) => feld(name)).join(";");
  const inhalt = zeilen.map((z) =>
    SPALTEN.map(([, lies]) => {
      try {
        return feld(lies(z));
      } catch {
        return feld("");
      }
    }).join(";"),
  );
  // BOM voranstellen, damit Excel UTF-8 erkennt.
  return "﻿" + [kopf, ...inhalt].join("\r\n") + "\r\n";
}
