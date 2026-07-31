/**
 * Erzeugt einen vollständig befüllten Beispielvertrag zur Sichtprüfung.
 *
 *   npm run pdf:test
 *
 * Ergebnis: tmp/test-vertrag.pdf
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { kundenFelder, kundenUnterschriftsfelder, vorOrtFelder, VOR_ORT_UNTERSCHRIFTEN } from "../src/lib/pdf/felder";
import { fuelleVertrag } from "../src/lib/pdf/fuellen";
import { STAMMDATEN_STANDARD } from "../src/lib/stammdaten";
import type { Bestellung, VorOrtErfassung } from "../src/lib/typen";

const BEISPIEL: Bestellung = {
  bestellerIstTeilnehmer: false,
  besteller: {
    anrede: "Frau",
    vorname: "Sabine",
    nachname: "Hofmann",
    telefon: "0170 1234567",
    email: "sabine.hofmann@example.de",
    bevollmaechtigt: true,
  },
  teilnehmer: {
    anrede: "Herr",
    vorname: "Karl",
    nachname: "Hofmann",
    geburtsdatum: "14.03.1941",
    strasse: "Lindenweg 12",
    plz: "63785",
    ort: "Obernburg",
    telefon: "06022 998877",
    email: "",
  },
  pflegegrad: "2",
  kostenuebernahme: true,
  pflegekasseName: "AOK Bayern – Pflegekasse",
  pflegekasseAnschrift: "Carl-Wery-Straße 28, 81739 München",
  versichertennummer: "A123456789",
  grundAlleinlebend: true,
  grundNotsituation: false,

  paketId: "komfortpaket",
  optionen: ["tagestaste", "servicegarantie"],

  anschlussart: "voip",
  telefonanbieter: "Telekom Deutschland GmbH",
  geraeteRufnummer: "06022 998877",

  kontaktpersonen: [
    {
      name: "Sabine Hofmann",
      bezugsart: "Sohn/Tochter",
      telefon: "0170 1234567",
      anschrift: "Ahornstraße 4, 63785 Obernburg",
      schluesselVorhanden: true,
    },
    {
      name: "Peter Weber",
      bezugsart: "Nachbar/-in, Bekannte",
      telefon: "06022 445566",
      anschrift: "Lindenweg 14, 63785 Obernburg",
      schluesselVorhanden: false,
    },
  ],

  keySafeStandortWunsch: "rechts neben der Haustür",
  zugangshinweise: "Erdgeschoss links, Klingelschild Hofmann",

  hausarztName: "Dr. med. Anna Krieger",
  hausarztTelefon: "06022 112233",
  notfallhinweise: "Hört schlecht, bitte laut sprechen.",

  vdkMitglied: true,
  vdkMitgliedsnummer: "VDK-556677",

  zahlungspflichtigerIstTeilnehmer: false,
  sepaKontoinhaber: "Sabine Hofmann",
  sepaAnschrift: "Ahornstraße 4, 63785 Obernburg",
  sepaIban: "DE02120300000000202051",
  sepaBic: "BYLADEM1MIL",
  sepaBank: "Sparkasse Miltenberg-Obernburg",

  bestaetigungen: {
    leistungenUndGeraete: true,
    kosten: true,
    hinweisePunkt4und5: true,
    datenblatt: true,
    schluesselAushaendigung: false,
    empfangsberechtigte: false,
    sepaMandat: true,
    widerrufsbelehrung: true,
    sofortigeErbringung: true,
    schweigepflichtentbindung: true,
    gesundheitsdaten: true,
    vdk: true,
    vollmachtPflegekasse: true,
    agb: true,
    datenschutz: true,
  },

  unterschrift: "",
  unterschriftOrt: "Obernburg",
};

const VOR_ORT: VorOrtErfassung = {
  mietgeraete: [
    { bezeichnung: "Hausnotrufgerät Tunstall Lifeline Smart Hub", idNummer: "LS-4711" },
    { bezeichnung: "Funksender Halskette", idNummer: "FS-8890" },
    { bezeichnung: "Schlüsseltresor KeySafe Supra C500", idNummer: "KS-1203" },
  ],
  technischeVoraussetzungen: "VoIP über Fritz!Box 7590, Notstromversorgung geprüft",
  gesundheit: {
    koerperlich: ["Gehbehinderung", "Schwerhörig", "Bluthochdruck", "Diabetes"],
    geistig: ["Verwirrtheit"],
    anmerkungKoerperlich: "Rollator im Einsatz, Sturzgefahr im Bad",
    anmerkungGeistig: "Zeitweise Orientierungsprobleme am Abend",
    medikamente: "Metformin 850 mg, Ramipril 5 mg, Marcumar",
    medikamentenallergien: "Penicillin",
  },
  datumInbetriebnahme: "05.08.2026",
  vorgangsnummer: "HNR-2026-0001",
  versorgungAb: "01.08.2026",
  anwesendVertreter: true,
  anwesendBetreuer: false,
  anwesendSonstige: false,
  ortInbetriebnahme: "Obernburg",
  unterschriftLeistungserbringer: "",
  unterschriftTeilnehmer: "",
  kaufGeraete: [],
};

async function main() {
  const png = await readFile(path.join(process.cwd(), "assets", "beispiel-unterschrift.png"));
  const bild = `data:image/png;base64,${png.toString("base64")}`;

  const werte = {
    ...kundenFelder(BEISPIEL, STAMMDATEN_STANDARD, "HNR-2026-0001", "31.07.2026"),
    ...vorOrtFelder(VOR_ORT, BEISPIEL, STAMMDATEN_STANDARD),
  };

  const unterschriften = [
    ...kundenUnterschriftsfelder(BEISPIEL).map((feld) => ({ feld, bild })),
    { feld: VOR_ORT_UNTERSCHRIFTEN.leistungserbringer, bild },
    { feld: VOR_ORT_UNTERSCHRIFTEN.teilnehmer, bild },
  ];

  const { pdf, warnungen } = await fuelleVertrag({ werte, unterschriften });

  await mkdir(path.join(process.cwd(), "tmp"), { recursive: true });
  const ziel = path.join(process.cwd(), "tmp", "test-vertrag.pdf");
  await writeFile(ziel, pdf);

  console.log(`Felder gesetzt: ${Object.keys(werte).length}`);
  console.log(`Unterschriften gestempelt: ${unterschriften.length}`);
  if (warnungen.length) {
    console.log(`\nWarnungen (${warnungen.length}):`);
    for (const w of warnungen) console.log(`  - ${w}`);
  } else {
    console.log("Keine Warnungen.");
  }
  console.log(`\nGeschrieben: ${ziel}`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
