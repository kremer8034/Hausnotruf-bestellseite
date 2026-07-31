/**
 * Preisberechnung.
 *
 * Aufbau entspricht der Preistabelle auf Vertragsseite 2:
 * eine Zeile Basisleistung, bis zu sechs Zeilen Zusatzleistung, eine Summenzeile.
 * Jede Zeile führt monatlich, einmalig und jährlich.
 */

import {
  PaketId,
  OptionId,
  VDK_RABATT_PROZENT,
  paketById,
  optionById,
  optionenFuerPaket,
} from "./katalog";

export interface PreisPosition {
  bezeichnung: string;
  monatlich: number;
  einmalig: number;
  /** Hochrechnung der monatlichen Kosten auf zwölf Monate. */
  jaehrlich: number;
  /** Vom VdK-Rabatt ausgenommen (z. B. Kaufpreis eines Geräts). */
  rabattfrei?: boolean;
}

export interface Preisauskunft {
  basis: PreisPosition;
  zusatz: PreisPosition[];
  summe: PreisPosition;
  /** Gewährter VdK-Rabatt in Euro, bezogen auf zwölf Monate plus Einmalkosten. */
  vdkRabattBetrag: number;
  /** Kosten im ersten Jahr: zwölf Monatsbeiträge plus alle Einmalkosten. */
  kostenErstesJahr: number;
  /** Kosten in den Folgejahren: nur die zwölf Monatsbeiträge. */
  kostenFolgejahr: number;
  inklusivEinsaetze: number;
  einsatzpauschale: number;
}

function runde(betrag: number): number {
  return Math.round((betrag + Number.EPSILON) * 100) / 100;
}

export interface PreisEingabe {
  paketId: PaketId;
  optionen: OptionId[];
  /** Kostenübernahme durch die Pflegekasse wird beantragt bzw. liegt vor. */
  kostenuebernahme: boolean;
  vdkMitglied: boolean;
}

export function berechnePreis(eingabe: PreisEingabe): Preisauskunft {
  const paket = paketById(eingabe.paketId);
  const rabattFaktor = eingabe.vdkMitglied ? 1 - VDK_RABATT_PROZENT / 100 : 1;

  const grundbetrag = eingabe.kostenuebernahme
    ? paket.monatlichMitKue
    : paket.monatlichOhneKue;
  if (grundbetrag === null) {
    throw new Error(
      `Paket "${paket.name}" ist ${
        eingabe.kostenuebernahme ? "mit" : "ohne"
      } Kostenübernahme nicht verfügbar.`,
    );
  }

  const basisMonatlich = runde(grundbetrag * rabattFaktor);
  const basis: PreisPosition = {
    bezeichnung: paket.name,
    monatlich: basisMonatlich,
    einmalig: 0,
    jaehrlich: runde(basisMonatlich * 12),
  };

  const zusatz: PreisPosition[] = [];

  if (paket.organisationspauschale > 0) {
    const betrag = runde(paket.organisationspauschale * rabattFaktor);
    zusatz.push({
      bezeichnung: "Einmalige Organisationspauschale",
      monatlich: 0,
      einmalig: betrag,
      jaehrlich: 0,
    });
  }

  if (paket.kaufpreis !== null) {
    // Der Kaufpreis ist vom VdK-Rabatt ausgenommen: die Kooperationsvereinbarung
    // nennt nur laufende Leistungen und die Organisationspauschale.
    zusatz.push({
      bezeichnung: `Kaufpreis ${paket.name} (inkl. MwSt.)`,
      monatlich: 0,
      einmalig: paket.kaufpreis,
      jaehrlich: 0,
      rabattfrei: true,
    });
  }

  const buchbar = new Set(optionenFuerPaket(paket.id).map((o) => o.id));
  for (const optionId of eingabe.optionen) {
    if (!buchbar.has(optionId)) {
      throw new Error(
        `Option "${optionId}" ist bei Paket "${paket.name}" nicht buchbar.`,
      );
    }
    const option = optionById(optionId);
    if (option.monatlich === 0) continue; // im Paket enthalten, keine eigene Zeile
    const monatlich = runde(option.monatlich * rabattFaktor);
    zusatz.push({
      bezeichnung: option.name,
      monatlich,
      einmalig: 0,
      jaehrlich: runde(monatlich * 12),
    });
  }

  const summeMonatlich = runde(
    [basis, ...zusatz].reduce((s, p) => s + p.monatlich, 0),
  );
  const summeEinmalig = runde(
    [basis, ...zusatz].reduce((s, p) => s + p.einmalig, 0),
  );
  const summe: PreisPosition = {
    bezeichnung: "Gesamt",
    monatlich: summeMonatlich,
    einmalig: summeEinmalig,
    jaehrlich: runde(summeMonatlich * 12),
  };

  // Ersparnis gegenüber dem regulären Preis, für die Anzeige im Formular.
  let vdkRabattBetrag = 0;
  if (eingabe.vdkMitglied) {
    const ohneRabatt = berechnePreis({ ...eingabe, vdkMitglied: false });
    vdkRabattBetrag = runde(
      ohneRabatt.kostenErstesJahr - (summe.jaehrlich + summe.einmalig),
    );
  }

  return {
    basis,
    zusatz,
    summe,
    vdkRabattBetrag,
    kostenErstesJahr: runde(summe.jaehrlich + summe.einmalig),
    kostenFolgejahr: summe.jaehrlich,
    inklusivEinsaetze: paket.inklusivEinsaetze,
    einsatzpauschale: paket.einsatzpauschale,
  };
}

const EURO = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function euro(betrag: number): string {
  return EURO.format(betrag);
}

/** Betrag ohne Währungszeichen, wie er in die PDF-Preistabelle eingetragen wird. */
export function euroPdf(betrag: number): string {
  return betrag === 0
    ? "–"
    : new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(betrag) + " €";
}
