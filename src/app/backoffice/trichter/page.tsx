import { Karte } from "@/components/ui";
import { db } from "@/lib/db";
import { SCHRITTE, SCHRITT_LABEL, Schritt } from "@/lib/typen";

export const dynamic = "force-dynamic";

/** Schritte in der Reihenfolge, in der Kunden sie durchlaufen. */
const ABLAUF: Schritt[] = SCHRITTE.filter((s) => s !== "start");

interface Ereignis {
  sitzung_id: string;
  schritt: Schritt;
  art: string;
  geraet: string | null;
  quelle: string | null;
  zeit: string;
}

export default async function Trichteransicht({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameter = await searchParams;
  const tage = Number(parameter.tage) || 30;
  const seit = new Date(Date.now() - tage * 24 * 3600 * 1000).toISOString();

  const { data, error } = await db()
    .from("ereignisse")
    .select("sitzung_id, schritt, art, geraet, quelle, zeit")
    .gte("zeit", seit)
    .order("zeit", { ascending: true })
    .limit(50000);

  const ereignisse = (data ?? []) as Ereignis[];

  // Je Sitzung merken, welche Schritte gesehen und welche beendet wurden.
  const sitzungen = new Map<
    string,
    { gesehen: Set<Schritt>; beendet: Set<Schritt>; geraet: string | null; quelle: string | null }
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

  const gesamtSitzungen = sitzungen.size;
  const abschluesse = [...sitzungen.values()].filter((s) =>
    s.gesehen.has("abgeschlossen"),
  ).length;

  const stufen = ABLAUF.filter((s) => s !== "abgeschlossen").map((schritt) => {
    const erreicht = [...sitzungen.values()].filter((s) => s.gesehen.has(schritt)).length;
    const beendet = [...sitzungen.values()].filter((s) => s.beendet.has(schritt)).length;
    return {
      schritt,
      erreicht,
      beendet,
      abbrueche: Math.max(0, erreicht - beendet),
      abbruchquote: erreicht > 0 ? (erreicht - beendet) / erreicht : 0,
    };
  });

  const groesstesLeck = [...stufen].sort((a, b) => b.abbrueche - a.abbrueche)[0];
  const geraete = zaehle([...sitzungen.values()].map((s) => s.geraet ?? "unbekannt"));
  const quellen = zaehle(
    [...sitzungen.values()].map((s) => s.quelle || "Direktaufruf"),
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tinte-900">Trichteransicht</h1>
          <p className="mt-1 text-sm text-tinte-500">
            Wo Besucher aussteigen, bevor der Vertrag zustande kommt.
          </p>
        </div>
        <form action="/backoffice/trichter" className="flex gap-2">
          <select name="tage" defaultValue={String(tage)} className="feld w-auto py-2 text-sm">
            <option value="7">Letzte 7 Tage</option>
            <option value="30">Letzte 30 Tage</option>
            <option value="90">Letzte 90 Tage</option>
            <option value="365">Letztes Jahr</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-tinte-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-tinte-900"
          >
            Anzeigen
          </button>
        </form>
      </div>

      {error && (
        <Karte>
          <p className="text-sm text-brk-700">
            Die Auswertung konnte nicht geladen werden: {error.message}
          </p>
        </Karte>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kennzahl titel="Begonnene Bestellungen" wert={String(gesamtSitzungen)} />
        <Kennzahl titel="Abgeschlossene Verträge" wert={String(abschluesse)} />
        <Kennzahl
          titel="Abschlussquote"
          wert={
            gesamtSitzungen > 0
              ? `${Math.round((abschluesse / gesamtSitzungen) * 100)} %`
              : "—"
          }
        />
      </div>

      {groesstesLeck && groesstesLeck.abbrueche > 0 && (
        <div className="mb-6 rounded-xl border border-brk-200 bg-brk-50 px-5 py-4">
          <p className="text-sm text-brk-900">
            <strong>Größter Absprungpunkt:</strong> {SCHRITT_LABEL[groesstesLeck.schritt]}{" "}
            — {groesstesLeck.abbrueche} von {groesstesLeck.erreicht} Besuchern brechen
            hier ab ({Math.round(groesstesLeck.abbruchquote * 100)} %). Hier lohnt sich
            eine Vereinfachung am meisten.
          </p>
        </div>
      )}

      <Karte className="mb-6">
        <h2 className="mb-4 text-base font-bold text-tinte-900">Schritt für Schritt</h2>
        <div className="space-y-3">
          {stufen.map((stufe) => {
            const anteil =
              gesamtSitzungen > 0 ? (stufe.erreicht / gesamtSitzungen) * 100 : 0;
            return (
              <div key={stufe.schritt}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-tinte-800">
                    {SCHRITT_LABEL[stufe.schritt]}
                  </span>
                  <span className="text-tinte-500">
                    {stufe.erreicht} erreicht · {stufe.beendet} weiter
                    {stufe.abbrueche > 0 && (
                      <span className="ml-2 font-medium text-brk-700">
                        −{stufe.abbrueche} ({Math.round(stufe.abbruchquote * 100)} %)
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded bg-tinte-100">
                  <div
                    className="flex h-full items-center rounded bg-brk-600 pl-2 text-xs font-medium text-white transition-all"
                    style={{ width: `${Math.max(anteil, 2)}%` }}
                  >
                    {anteil >= 12 && `${Math.round(anteil)} %`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {gesamtSitzungen === 0 && (
          <p className="mt-4 text-sm text-tinte-500">
            In diesem Zeitraum wurde noch keine Bestellung begonnen.
          </p>
        )}
      </Karte>

      <div className="grid gap-6 sm:grid-cols-2">
        <Karte>
          <h2 className="mb-4 text-base font-bold text-tinte-900">Geräte</h2>
          <Verteilung eintraege={geraete} gesamt={gesamtSitzungen} />
        </Karte>
        <Karte>
          <h2 className="mb-4 text-base font-bold text-tinte-900">Herkunft</h2>
          <Verteilung eintraege={quellen} gesamt={gesamtSitzungen} />
        </Karte>
      </div>
    </>
  );
}

function Kennzahl({ titel, wert }: { titel: string; wert: string }) {
  return (
    <div className="rounded-xl border border-tinte-200 bg-white p-5">
      <p className="text-xs font-semibold tracking-wide text-tinte-500 uppercase">
        {titel}
      </p>
      <p className="mt-1 text-2xl font-bold text-tinte-900">{wert}</p>
    </div>
  );
}

function Verteilung({
  eintraege,
  gesamt,
}: {
  eintraege: [string, number][];
  gesamt: number;
}) {
  if (eintraege.length === 0) {
    return <p className="text-sm text-tinte-500">Noch keine Daten.</p>;
  }
  return (
    <dl className="space-y-2 text-sm">
      {eintraege.slice(0, 6).map(([name, anzahl]) => (
        <div key={name} className="flex items-baseline justify-between gap-3">
          <dt className="truncate text-tinte-600">{beschriftung(name)}</dt>
          <dd className="shrink-0 font-medium text-tinte-900">
            {anzahl}
            {gesamt > 0 && (
              <span className="ml-1.5 text-xs font-normal text-tinte-500">
                {Math.round((anzahl / gesamt) * 100)} %
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function beschriftung(name: string): string {
  return (
    { handy: "Handy", tablet: "Tablet", rechner: "Rechner", unbekannt: "Unbekannt" }[
      name
    ] ?? name
  );
}

function zaehle(werte: string[]): [string, number][] {
  const zaehler = new Map<string, number>();
  for (const wert of werte) zaehler.set(wert, (zaehler.get(wert) ?? 0) + 1);
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]);
}
