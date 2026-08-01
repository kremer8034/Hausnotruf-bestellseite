import { Karte } from "@/components/ui";
import { db } from "@/lib/db";
import { Ereignis, werteAus } from "@/lib/trichter";
import { SCHRITT_LABEL } from "@/lib/typen";

export const dynamic = "force-dynamic";

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

  // Die Zahl der Abschlüsse kommt aus dem Vertragsbestand, nicht aus den
  // Meldungen des Browsers: Die letzte Meldung geht per sendBeacon raus und
  // kann verlorengehen, wenn der Kunde das Fenster sofort schließt. Ein
  // geschlossener Vertrag steht dagegen fest.
  const { count: vertraege } = await db()
    .from("vertraege")
    .select("id", { count: "exact", head: true })
    .gte("erstellt_am", seit);

  const {
    gesamtSitzungen,
    abschluesse,
    abschlussquote,
    stufen,
    groesstesLeck,
    geraete,
    quellen,
  } = werteAus(ereignisse, vertraege ?? 0);

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
        <Kennzahl
          titel="Begonnene Bestellungen"
          wert={String(gesamtSitzungen)}
          fussnote="Bestellvorgänge, die begonnen wurden"
        />
        <Kennzahl
          titel="Abgeschlossene Verträge"
          wert={String(abschluesse)}
          fussnote="gezählt im Vertragsbestand"
        />
        <Kennzahl
          titel="Abschlussquote"
          wert={
            abschlussquote !== null ? `${Math.round(abschlussquote * 100)} %` : "—"
          }
          fussnote={
            gesamtSitzungen > 0
              ? `${abschluesse} von ${gesamtSitzungen} Bestellvorgängen`
              : undefined
          }
        />
      </div>

      {groesstesLeck && groesstesLeck.abbrueche > 0 && (
        <div className="mb-6 rounded-xl border border-brk-200 bg-brk-50 px-5 py-4">
          <p className="text-sm text-brk-900">
            <strong>Größter Absprungpunkt:</strong> {SCHRITT_LABEL[groesstesLeck.schritt]}{" "}
            — {groesstesLeck.abbrueche} von {groesstesLeck.erreicht} Bestellvorgängen brechen
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

function Kennzahl({
  titel,
  wert,
  fussnote,
}: {
  titel: string;
  wert: string;
  fussnote?: string;
}) {
  return (
    <div className="rounded-xl border border-tinte-200 bg-white p-5">
      <p className="text-xs font-semibold tracking-wide text-tinte-500 uppercase">
        {titel}
      </p>
      <p className="mt-1 text-2xl font-bold text-tinte-900">{wert}</p>
      {fussnote && <p className="mt-0.5 text-xs text-tinte-500">{fussnote}</p>}
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
