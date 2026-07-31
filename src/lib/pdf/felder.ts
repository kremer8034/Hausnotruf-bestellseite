/**
 * Zuordnung der Bestelldaten auf die Formularfelder des BRK-Servicevertrags.
 *
 * Achtung bei den Feldnamen: ein Teil des Originals ist irreführend benannt.
 * Die Zuordnung stammt aus der Positionsanalyse (tools/analyze_pdf_fields.py)
 * und nicht aus den Namen selbst. Die wichtigsten Fälle:
 *
 *   KV_Nummer            = Versichertennummer des Teilnehmers (nicht des Verbands)
 *   Preistabelle_B*      = Spalte "monatlich"
 *   Preistabelle_C*      = Spalte "einmalig"
 *   Preistabelle_D*      = Spalte "jährlich"
 *   Leistung_HNR 15..28  = Bestätigungshaken der Zusammenfassung (Seite 27)
 *   Leistung_HNR 2..13 / Leistung_MR_3..25 = Gesundheitsdaten (Seite 22)
 *   TN_Geburtsdatum 8..24 / TN_Vertreter 8..16 = Depot- und Kaufbelegfelder
 */

import { berechnePreis, euroPdf } from "../preis";
import { paketById } from "../katalog";
import { Stammdaten } from "../stammdaten";
import { Bestellung, Gesundheitsdaten, VorOrtErfassung } from "../typen";

export type Feldwerte = Record<string, string | boolean>;

/** Gesundheitsdaten Anlage 11, Teil A – körperliche Einschränkungen. */
export const GESUNDHEIT_KOERPERLICH: Record<string, string> = {
  Gehbehinderung: "Leistung_HNR 2",
  Gleichgewichtsprobleme: "Leistung_MR_3",
  "Körperliche Behinderung": "Leistung_MR_4",
  Sehbehinderung: "Leistung_HNR 3",
  Blind: "Leistung_MR_5",
  Sprachstörungen: "Leistung_MR_6",
  Stumm: "Leistung_HNR 4",
  Schwerhörig: "Leistung_MR_7",
  Taub: "Leistung_MR_9",
  Schlaganfall: "Leistung_HNR 5",
  "Venenschwäche, Thrombosegefahr": "Leistung_MR_10",
  "Geschwüre, offenes Bein": "Leistung_HNR 6",
  Krebs: "Leistung_MR_11",
  Inkontinenz: "Leistung_MR_12",
  Darmerkrankungen: "Leistung_MR_22",
  Herzinfarkt: "Leistung_HNR 7",
  Herzprobleme: "Leistung_MR_13",
  Herzschrittmacher: "Leistung_MR_18",
  Bluthochdruck: "Leistung_HNR 9",
  Blutverdünnung: "Leistung_MR_15",
  Arteriosklerose: "Leistung_MR_20",
  Diabetes: "Leistung_HNR 8",
  Rheuma: "Leistung_MR_14",
  Arthrose: "Leistung_MR_19",
  Gicht: "Leistung_HNR 10",
  Osteoporose: "Leistung_MR_16",
  "Multiple Sklerose": "Leistung_MR_21",
  Asthma: "Leistung_HNR 11",
  "Chronische Bronchitis (COPD)": "Leistung_MR_17",
};

/** Gesundheitsdaten Anlage 11, Teil B – geistige/neurologische Einschränkungen. */
export const GESUNDHEIT_GEISTIG: Record<string, string> = {
  Demenz: "Leistung_HNR 12",
  "Geistige Behinderung": "Leistung_HNR 13",
  Verwirrtheit: "Leistung_MR_8",
  Epilepsie: "Leistung_MR_23",
  Depression: "Leistung_MR_24",
  Parkinson: "Leistung_MR_25",
};

/** Bestätigungshaken der Zusammenfassung auf Seite 27. */
const BESTAETIGUNG_FELD = {
  leistungenUndGeraete: "Leistung_HNR 15",
  kosten: "Leistung_HNR 17",
  hinweisePunkt4und5: "Leistung_HNR 18",
  datenblatt: "Leistung_HNR 19",
  schluesselAushaendigung: "Leistung_HNR 20",
  empfangsberechtigte: "Leistung_HNR 21",
  sepaMandat: "Leistung_HNR 22",
  widerrufsbelehrung: "Leistung_HNR 23",
  sofortigeErbringung: "Leistung_HNR 24",
  schweigepflichtentbindung: "Leistung_HNR 25",
  gesundheitsdaten: "Leistung_HNR 26",
  vdk: "Leistung_HNR 27",
  vollmachtPflegekasse: "Leistung_HNR 28",
} as const;

export function heute(): string {
  return new Date().toLocaleDateString("de-DE");
}

function nameZeile(vorname: string, nachname: string): string {
  return `${nachname}, ${vorname}`;
}

function anschriftZeile(strasse: string, plz: string, ort: string): string {
  return `${strasse}, ${plz} ${ort}`;
}

/** IBAN in Viererblöcken, wie sie auf Formularen üblich ist. */
export function ibanFormatiert(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Baut die Feldwerte für den Kundenteil des Vertrags.
 *
 * @param datum Abschlussdatum, Standard ist heute.
 * @param mandatsreferenz Referenz des SEPA-Mandats (interne Vorgangsnummer).
 */
export function kundenFelder(
  b: Bestellung,
  s: Stammdaten,
  mandatsreferenz: string,
  datum: string = heute(),
): Feldwerte {
  const paket = paketById(b.paketId);
  const preis = berechnePreis({
    paketId: b.paketId,
    optionen: b.optionen,
    kostenuebernahme: b.kostenuebernahme,
    vdkMitglied: b.vdkMitglied,
  });

  const tnName = nameZeile(b.teilnehmer.vorname, b.teilnehmer.nachname);
  const tnAnschrift = anschriftZeile(
    b.teilnehmer.strasse,
    b.teilnehmer.plz,
    b.teilnehmer.ort,
  );
  const ortDatum = `${b.unterschriftOrt}, ${datum}`;
  const vertreter = b.besteller
    ? `${b.besteller.vorname} ${b.besteller.nachname}, ${b.besteller.telefon}`
    : "";

  const f: Feldwerte = {};

  // ---- Seite 1: Vertragsrahmen -------------------------------------------
  f["Vertragsnummer"] = ""; // wird vom Kreisverband manuell vergeben
  f["Ort_Datum"] = ortDatum;
  f["KV_Name"] = s.verbandsName;
  f["KV_Anschrift"] = s.verbandsAnschrift;
  f["KV_Vertreter"] = s.vertretenDurch;
  f["KV_Telefon"] = s.telefon;
  f["KV_Kontaktdaten"] = [s.telefon, s.fax, s.email].filter(Boolean).join(" / ");
  f["TN_Anrede"] = b.teilnehmer.anrede;
  f["TN_Name"] = tnName;
  f["TN_Geburtsdatum"] = b.teilnehmer.geburtsdatum;
  f["TN_Telefon"] = b.teilnehmer.telefon;
  f["TN_Anschrift"] = tnAnschrift;
  f["TN_Email-Adresse"] = b.teilnehmer.email || b.besteller?.email || "";
  f["TN_Vertreter"] = vertreter;
  f["TN_Pflegegrad"] =
    b.pflegegrad === "ohne" ? "Pflegegrad ohne" : `Pflegegrad ${b.pflegegrad}`;
  f["Vertrag"] = true; // "wird ab dem"
  f["Vertragsbeginn"] = datum;
  f["Vertragsart"] = "/0"; // unbefristet
  f["Vertragsende"] = "";
  f["Kontakt_Mitarbeiter"] = s.hausnotrufbeauftragter;

  // ---- Seite 2: Leistung, Geräteausstattung, Preis ------------------------
  f[paket.leistungsfeld] = true;
  f["Leistung_Depot"] = true; // Schlüsseltresor ist bei allen Paketen Bestandteil
  f["Leistung_Helfereinsatz"] = true; // Hintergrunddienst ist Teil jedes Pakets
  f["Leistung_Pauschale"] = paket.organisationspauschale > 0;
  f["Leistung_Tagestaste"] = b.optionen.includes("tagestaste");
  f["Leistung_Sensoren"] = b.optionen.includes("rauchmelder");
  f["Leistung_Sonstiges"] = b.optionen.includes("servicegarantie");

  f["Ausstattung_1"] = true; // Geräte werden mietweise gestellt
  f["Ausstattung_2"] = false; // kein eigenes Gerät des Teilnehmers
  f["Ausstattung_3"] = paket.simKarte; // SIM-Karte vom BRK
  f["Ausstattung_4"] = false; // keine eigene SIM-Karte

  f["Preistabelle_A1"] = preis.basis.bezeichnung;
  f["Preistabelle_B1"] = euroPdf(preis.basis.monatlich);
  f["Preistabelle_C1"] = euroPdf(preis.basis.einmalig);
  f["Preistabelle_D1"] = euroPdf(preis.basis.jaehrlich);

  // Zeilen 2 bis 7 sind für Zusatzleistungen vorgesehen.
  for (let i = 0; i < 6; i++) {
    const zeile = i + 2;
    const p = preis.zusatz[i];
    f[`Preistabelle_A${zeile}`] = p ? p.bezeichnung : "";
    f[`Preistabelle_B${zeile}`] = p ? euroPdf(p.monatlich) : "";
    f[`Preistabelle_C${zeile}`] = p ? euroPdf(p.einmalig) : "";
    f[`Preistabelle_D${zeile}`] = p ? euroPdf(p.jaehrlich) : "";
  }

  // Summenzeile – dieselben Felder erscheinen auch auf Seite 27.
  f["Preistabelle_B8"] = euroPdf(preis.summe.monatlich);
  f["Preistabelle_C8"] = euroPdf(preis.summe.einmalig);
  f["Preistabelle_D8"] = euroPdf(preis.summe.jaehrlich);
  f["Zahl_Helfereinsätze"] = String(preis.inklusivEinsaetze);

  // ---- Seite 3: Kenntnisnahme --------------------------------------------
  f["Zusatz_Schweigepflichtentbindung"] = s.schweigepflichtentbindung
    .slice(0, 3)
    .join(", ");
  f["Zusatzvereinbarungen"] = b.vdkMitglied
    ? `VdK-Mitgliedschaft nachgewiesen (Mitgliedsnummer ${b.vdkMitgliedsnummer}). Rabatt von 7 % auf laufende Leistungen und Organisationspauschale gewährt.`
    : "";

  // ---- Seite 4: Datenblatt Teil 1 und 2 -----------------------------------
  f["Nummer_Geraet"] = b.geraeteRufnummer;
  f["Anbieter_Telekom"] = b.telefonanbieter;
  f["Technische_Voraussetzungen"] = {
    gsm: "GSM-Anschluss",
    voip: "Breitbandanschluss mit VoIP",
    msan: "MSAN-POTS",
  }[b.anschlussart];
  f["Voraussetzung_GSM"] = b.anschlussart === "gsm";
  f["Voraussetzung_Voip"] = b.anschlussart === "voip";
  f["Voraussetzung_MSAN"] = b.anschlussart === "msan";

  // ---- Seite 5: Kontaktpersonen, Region, weitere Informationen ------------
  for (let i = 0; i < 4; i++) {
    const nr = i + 1;
    const k = b.kontaktpersonen[i];
    f[`BP_Name_${nr}`] = k ? k.name : "";
    f[`BP_Art_${nr}`] = k ? k.bezugsart : "";
    f[`BP_Telefon_${nr}`] = k ? k.telefon : "";
    f[`BP_Anschrift_${nr}`] = k ? k.anschrift : "";
    if (k) f[`BP_Schluessel_${nr}`] = k.schluesselVorhanden ? "/Auswahl1" : "/Auswahl2";
  }
  // Teil 4 (dem BRK ausgehändigte Schlüssel) bleibt leer: der Kreisverband
  // bewahrt keine Schlüssel auf, stattdessen wird ein Schlüsseltresor gesetzt.
  f["MR_Region"] = paket.leistungsfeld === "Leistung_HNR" ? "" : s.mobilrufRegion;
  f["Zusatzinformationen"] = [
    b.hausarztName && `Hausarzt: ${b.hausarztName}${b.hausarztTelefon ? `, ${b.hausarztTelefon}` : ""}`,
    b.keySafeStandortWunsch && `Schlüsseltresor gewünscht: ${b.keySafeStandortWunsch}`,
    b.zugangshinweise && `Zugang: ${b.zugangshinweise}`,
    b.notfallhinweise,
  ]
    .filter(Boolean)
    .join(" | ");

  // ---- Seite 6: SEPA-Basislastschriftmandat -------------------------------
  f["Glaeubiger_ID"] = s.glaeubigerId;
  f["SEPA_Zahlungen"] = "monatliche Zahlung";
  f["SEPA_Mandatref"] = mandatsreferenz;
  f["SEPA_Zahlungspflichtiger_Name"] = b.sepaKontoinhaber;
  f["SEPA_Zahlungspflichtiger_Adresse"] = b.sepaAnschrift;
  f["SEPA_IBAN"] = ibanFormatiert(b.sepaIban);
  f["SEPA_BIC"] = b.sepaBic;
  f["SEPA_Bank"] = b.sepaBank;
  f["SEPA_Frist_Tage"] = s.sepaFristTage;

  // ---- Seite 8: Muster-Widerrufsformular ----------------------------------
  // Bewusst nur vorbelegt, nicht unterschrieben: der Kunde nutzt es nur,
  // wenn er tatsächlich widerrufen möchte.
  f["Widerruf_Dienstleistungen"] = `Hausnotruf/Mobilruf – ${paket.name}`;
  f["Datum_Bestellung"] = datum;
  f["Ort_Datum 2"] = "";

  // ---- Seite 10: Datenschutzhinweise --------------------------------------
  f["Datenschutzbeauftragter"] = s.datenschutzbeauftragter;
  f["Aufsichtsbehoerde"] = s.aufsichtsbehoerde;

  // ---- Seite 12: Entbindung von der Schweigepflicht -----------------------
  s.schweigepflichtentbindung.slice(0, 7).forEach((eintrag, i) => {
    f[`Entbindung_${i + 1}`] = eintrag;
  });

  // ---- Seiten 17/18: Anlage 8, nur bei Kostenübernahme --------------------
  f["KV_Nummer"] = b.versichertennummer; // Feldname irreführend: Versichertennummer
  f["KV_IK"] = s.ik;
  f["HNR_System"] = paket.hnrSystem;
  f["Pflegekasse"] = b.pflegekasseName;
  f["Pflegekasse_Anschrift"] = [b.pflegekasseName, b.pflegekasseAnschrift]
    .filter(Boolean)
    .join(", ");

  if (b.kostenuebernahme) {
    f["Datum_Beratung"] = datum;
    f["Anwesend_Vertreter"] = Boolean(b.besteller);
    f["Anwesend_Betreuer"] = false;
    f["Anwesend_Sonstige"] = false;

    const mehrkostenfrei = preis.summe.monatlich === 0 && preis.summe.einmalig === 0;
    f["Mehrkosten"] = mehrkostenfrei ? "/Auswahl1" : "/Auswahl2";

    f["Datum_Antrag"] = datum;
    f["Grund_Alleinlebend"] = b.grundAlleinlebend;
    f["Grund_Notsituation"] = b.grundNotsituation;

    const zusatzleistungen = b.optionen.length > 0;
    f["Zusatzaustattung"] = false;
    f["Zusatzausstattung_Beschreibung"] = "";
    f["Dienstleistungen"] = !mehrkostenfrei;
    f["Dienstleistungen_Schluessel"] = !mehrkostenfrei; // Schlüsseltresor
    f["Dienstleistungen_Bereitschaft"] = b.optionen.includes("servicegarantie");
    f["Dienstleistungen_Aktivruf"] = false;
    f["Dienstleistungen_Notdienst"] = b.optionen.includes("rauchmelder");
    f["Dienstleistungen_Tagestaste"] = b.optionen.includes("tagestaste");
    f["Dienstleistungen_Weitere"] = zusatzleistungen;
    f["Dienstleistungen_Weitere_Beschreibung"] = preis.zusatz
      .map((p) => p.bezeichnung)
      .join(", ");
    f["Kosten_Einmalig"] = euroPdf(preis.summe.einmalig);
    f["Kosten_Monatlich"] = euroPdf(preis.summe.monatlich);

    f["Kontaktwunsch_TN"] = !b.besteller;
    f["Kontaktwunsch_Betreuer"] = Boolean(b.besteller);
    f["Kontaktwunsch_Pflegedienst"] = false;
    f["Kontaktwunsch_HNRAnbieter"] = false;
    f["Kontaktwunsch_Kontaktdaten"] = b.besteller
      ? `${b.besteller.vorname} ${b.besteller.nachname}, ${b.besteller.telefon}, ${b.besteller.email}`
      : `${b.teilnehmer.vorname} ${b.teilnehmer.nachname}, ${b.teilnehmer.telefon}`;

    // Das Gerät wird erst bei der Installation in Betrieb genommen.
    f["HNR_Betrieb"] = "/Auswahl1";
    f["HNR_Betrieb_Seit"] = "";
  }

  // ---- Seite 27: Zusammenfassung -----------------------------------------
  for (const [schluessel, feld] of Object.entries(BESTAETIGUNG_FELD)) {
    f[feld] = Boolean(b.bestaetigungen[schluessel as keyof typeof BESTAETIGUNG_FELD]);
  }
  // Es werden keine Schlüssel an das BRK ausgehändigt (Schlüsseltresor).
  f["Preistabelle_C25"] = "";

  return f;
}

/** Ergänzt die vom Techniker vor Ort erfassten Angaben. */
export function vorOrtFelder(
  v: VorOrtErfassung,
  b: Bestellung,
  s: Stammdaten,
): Feldwerte {
  const f: Feldwerte = {};

  // ---- Seite 4: Geräteliste ----------------------------------------------
  for (let i = 0; i < 5; i++) {
    const geraet = v.mietgeraete[i];
    f[`Leihgeraet_${i + 1}`] = geraet ? geraet.bezeichnung : "";
    f[`Leihgeraet_${i + 1}_ID`] = geraet ? geraet.idNummer : "";
  }
  if (v.technischeVoraussetzungen) {
    f["Technische_Voraussetzungen"] = v.technischeVoraussetzungen;
  }

  // ---- Seite 22: Gesundheitsdaten ----------------------------------------
  Object.assign(f, gesundheitsFelder(v.gesundheit));

  // ---- Seiten 19/20: Inbetriebnahme, Empfangs- und Einweisungsbestätigung -
  f["Datum_Inbetriebnahme"] = v.datumInbetriebnahme;
  f["Vorgangsnummer"] = v.vorgangsnummer;
  f["Versorgung_ab"] = v.versorgungAb;
  f["Anwesend_Vertreter"] = v.anwesendVertreter;
  f["Anwesend_Betreuer"] = v.anwesendBetreuer;
  f["Anwesend_Sonstige"] = v.anwesendSonstige;
  f["Ort_Datum_Inbetriebnahme"] = `${v.ortInbetriebnahme}, ${v.datumInbetriebnahme}`;
  f["Ort_Datum_Empfang"] = `${v.ortInbetriebnahme}, ${v.datumInbetriebnahme}`;

  // Das Gerät ist jetzt in Betrieb – Angabe auf Anlage 8 nachziehen.
  if (b.kostenuebernahme) {
    f["HNR_Betrieb"] = "/Auswahl2";
    f["HNR_Betrieb_Seit"] = v.datumInbetriebnahme;
  }

  // ---- Seite 26: Kaufbeleg (nur bei Geräten mit Kaufpreis) ---------------
  // Feldnamen im Original irreführend: TN_Geburtsdatum 12..14 ist die
  // Gerätebezeichnung, 15..17 die Seriennummer.
  v.kaufGeraete.slice(0, 3).forEach((g, i) => {
    f[`TN_Geburtsdatum ${12 + i}`] = g.bezeichnung;
    f[`TN_Geburtsdatum ${15 + i}`] = g.seriennummer;
    f[`Preistabelle_G${i + 1}`] = g.kosten;
  });
  if (v.kaufGeraete.length > 0) {
    const summe = v.kaufGeraete.reduce(
      (s2, g) => s2 + (parseFloat(g.kosten.replace(",", ".")) || 0),
      0,
    );
    f["Preistabelle_G-Gesamt"] = summe.toFixed(2).replace(".", ",") + " €";
  }

  void s;
  return f;
}

export function gesundheitsFelder(g: Gesundheitsdaten): Feldwerte {
  const f: Feldwerte = {};
  for (const [bezeichnung, feld] of Object.entries(GESUNDHEIT_KOERPERLICH)) {
    f[feld] = g.koerperlich.includes(bezeichnung);
  }
  for (const [bezeichnung, feld] of Object.entries(GESUNDHEIT_GEISTIG)) {
    f[feld] = g.geistig.includes(bezeichnung);
  }
  f["TN_Name 3"] = g.anmerkungKoerperlich;
  f["TN_Name 4"] = g.anmerkungGeistig;
  f["TN_Name 5"] = g.medikamente;
  f["TN_Name 6"] = g.medikamentenallergien;
  return f;
}

/**
 * Anlage 10: die BRK-Preisliste des Kreisverbands.
 * Wird mit dem vollständigen Katalog befüllt, damit der Kunde sie erhält.
 */
export function preislistenFelder(s: Stammdaten): Feldwerte {
  const f: Feldwerte = {};
  f["KV_Name"] = s.verbandsName;
  return f;
}

/** Positionen, an denen die Unterschrift des Kunden gestempelt wird. */
export function kundenUnterschriftsfelder(b: Bestellung): string[] {
  const felder = ["Unterschriftsfeld 12"]; // Zusammenfassung, Seite 27
  if (b.kostenuebernahme) {
    felder.push("Unterschriftenfeld 8"); // Beratungsdokumentation, Seite 18
    felder.push("Unterschriftenfeld 9"); // Antrag auf Kostenübernahme, Seite 18
  }
  return felder;
}

/** Positionen der Unterschriften bei der Installation vor Ort. */
export const VOR_ORT_UNTERSCHRIFTEN = {
  leistungserbringer: "Unterschriftenfeld 10", // Seite 19
  teilnehmer: "Unterschriftenfeld 11", // Seite 20
} as const;
