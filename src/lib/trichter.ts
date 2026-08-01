import { SCHRITTE, Schritt } from "./typen";

/** Schritte in der Reihenfolge, in der Kunden sie durchlaufen. */
export const ABLAUF: Schritt[] = SCHRITTE.filter((s) => s !== "start");

export interface Ereignis {
  sitzung_id: string;
  schritt: Schritt;
  art: string;
  geraet: string | null;
  quelle: string | null;
  zeit: string;
}

export interface Stufe {
  schritt: Schritt;
  erreicht: number;
  beendet: number;
  abbrueche: number;
  abbruchquote: number;
}

export interface Trichterwerte {
  gesamtSitzungen: number;
  sitzungenMitAbschluss: number;
  abschluesse: number;
  abschlussquote: number | null;
  stufen: Stufe[];
  groesstesLeck: Stufe | null;
  geraete: [string, number][];
  quellen: [string, number][];
}

/**
 * Rechnet Ereignisse und Vertragszahl zu den Trichterwerten zusammen.
 *
 * Bewusst als reine Funktion und ohne Datenbank: Diese Rechnung war schon
 * zweimal falsch, ohne dass es jemandem auffiel. So lässt sie sich gegen
 * echte Daten nachrechnen.
 */
export function werteAus(ereignisse: Ereignis[], vertraege: number): Trichterwerte {
  const sitzungen = new Map<
    string,
    {
      gesehen: Set<Schritt>;
      beendet: Set<Schritt>;
      geraet: string | null;
      quelle: string | null;
    }
  >();

  for (const e of ereignisse) {
    let s = sitzungen.get(e.sitzung_id);
    if (!s) {
      s = { gesehen: new Set(), beendet: new Set(), geraet: e.geraet, quelle: e.quelle };
      sitzungen.set(e.sitzung_id, s);
    }
    if (e.art === "angesehen") s.gesehen.add(e.schritt);
    if (e.art === "abgeschlossen") s.beendet.add(e.schritt);
    if (!s.geraet && e.geraet) s.geraet = e.geraet;
    if (!s.quelle && e.quelle) s.quelle = e.quelle;
  }

  const alle = [...sitzungen.values()];
  const gesamtSitzungen = alle.length;

  /**
   * Hat diese Sitzung zum Abschluss geführt?
   *
   * Der Assistent meldet den Abschluss als Art "abgeschlossen". Ein
   * "angesehen" gibt es für diesen Schritt nicht, weil danach keine Seite des
   * Assistenten mehr folgt - genau daran ist die Zählung zuvor gescheitert.
   * Beide Arten zuzulassen macht die Auswertung davon unabhängig.
   */
  const hatAbschluss = (s: (typeof alle)[number]) =>
    s.beendet.has("abgeschlossen") || s.gesehen.has("abgeschlossen");

  const sitzungenMitAbschluss = alle.filter(hatAbschluss).length;

  const stufen = ABLAUF.filter((s) => s !== "abgeschlossen").map((schritt) => {
    const erreicht = alle.filter((s) => s.gesehen.has(schritt)).length;
    const beendet = alle.filter(
      (s) =>
        s.beendet.has(schritt) ||
        // Die Zusammenfassung verlässt man nicht mit "Weiter", sondern mit
        // "Vertrag abschließen". Ohne diese Ausnahme stünde der letzte Schritt
        // als Totalabsprung da - ausgerechnet dort, wo der Vertrag entsteht.
        (schritt === "zusammenfassung" && hatAbschluss(s)),
    ).length;
    return {
      schritt,
      erreicht,
      beendet,
      abbrueche: Math.max(0, erreicht - beendet),
      abbruchquote: erreicht > 0 ? (erreicht - beendet) / erreicht : 0,
    };
  });

  const sortiert = [...stufen].sort((a, b) => b.abbrueche - a.abbrueche);

  return {
    gesamtSitzungen,
    sitzungenMitAbschluss,
    abschluesse: vertraege,
    abschlussquote:
      gesamtSitzungen > 0 ? sitzungenMitAbschluss / gesamtSitzungen : null,
    stufen,
    groesstesLeck: sortiert[0] ?? null,
    geraete: zaehle(alle.map((s) => s.geraet ?? "unbekannt")),
    quellen: zaehle(alle.map((s) => s.quelle || "Direktaufruf")),
  };
}

function zaehle(werte: string[]): [string, number][] {
  const zaehler = new Map<string, number>();
  for (const wert of werte) zaehler.set(wert, (zaehler.get(wert) ?? 0) + 1);
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]);
}
