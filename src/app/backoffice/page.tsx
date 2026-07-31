import Link from "next/link";

import { StatusZeichen } from "@/components/statuszeichen";
import { Karte } from "@/components/ui";
import { db } from "@/lib/db";
import { PaketId, paketById } from "@/lib/katalog";
import { euro } from "@/lib/preis";
import { STATUS_LABEL, VertragsStatus, VERTRAGS_STATUS } from "@/lib/typen";

export const dynamic = "force-dynamic";

interface Zeile {
  id: string;
  vorgangsnummer: string;
  vertragsnummer: string | null;
  status: VertragsStatus;
  paket: string;
  kostenuebernahme: boolean;
  erstellt_am: string;
  vor_ort_am: string | null;
  preis: { summe: { monatlich: number; einmalig: number } };
  daten: {
    teilnehmer: { vorname: string; nachname: string; ort: string };
    besteller?: { vorname: string; nachname: string };
  };
}

export default async function Vertragsliste({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameter = await searchParams;
  const status = typeof parameter.status === "string" ? parameter.status : "";
  const suche = typeof parameter.suche === "string" ? parameter.suche.trim() : "";

  let abfrage = db()
    .from("vertraege")
    .select(
      "id, vorgangsnummer, vertragsnummer, status, paket, kostenuebernahme, erstellt_am, vor_ort_am, preis, daten",
    )
    .order("erstellt_am", { ascending: false })
    .limit(200);

  if (VERTRAGS_STATUS.includes(status as VertragsStatus)) {
    abfrage = abfrage.eq("status", status);
  }
  if (suche) {
    // Suche über Vorgangsnummer und den Namen im JSON-Feld.
    abfrage = abfrage.or(
      `vorgangsnummer.ilike.%${suche}%,vertragsnummer.ilike.%${suche}%,daten->teilnehmer->>nachname.ilike.%${suche}%`,
    );
  }

  const { data, error } = await abfrage;
  const vertraege = (data ?? []) as unknown as Zeile[];

  const { count: gesamt } = await db()
    .from("vertraege")
    .select("id", { count: "exact", head: true });

  const exportParameter = new URLSearchParams();
  if (status) exportParameter.set("status", status);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tinte-900">Verträge</h1>
          <p className="mt-1 text-sm text-tinte-500">
            {gesamt ?? 0} abgeschlossene Verträge insgesamt
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/backoffice/export?${exportParameter}`}
            className="rounded-lg border border-tinte-300 bg-white px-4 py-2 text-sm font-medium text-tinte-700 transition hover:bg-tinte-100"
          >
            CSV herunterladen
          </a>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/backoffice">
        <input
          name="suche"
          defaultValue={suche}
          placeholder="Nummer oder Nachname"
          className="feld max-w-xs"
        />
        <select name="status" defaultValue={status} className="feld max-w-[13rem]">
          <option value="">Alle Status</option>
          {VERTRAGS_STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-tinte-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-tinte-900"
        >
          Filtern
        </button>
      </form>

      {error && (
        <Karte>
          <p className="text-sm text-brk-700">
            Die Verträge konnten nicht geladen werden: {error.message}
          </p>
        </Karte>
      )}

      {!error && vertraege.length === 0 && (
        <Karte>
          <p className="text-sm text-tinte-600">
            {suche || status
              ? "Zu diesem Filter gibt es keine Verträge."
              : "Es wurde noch kein Vertrag abgeschlossen."}
          </p>
        </Karte>
      )}

      {vertraege.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-tinte-200 bg-white">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-tinte-200 bg-tinte-50 text-left text-xs tracking-wide text-tinte-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Vorgang</th>
                <th className="px-4 py-3 font-medium">Teilnehmer</th>
                <th className="px-4 py-3 font-medium">Paket</th>
                <th className="px-4 py-3 text-right font-medium">Monatlich</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Vor Ort</th>
                <th className="px-4 py-3 font-medium">Eingang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tinte-100">
              {vertraege.map((v) => (
                <tr key={v.id} className="transition hover:bg-tinte-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/backoffice/vertrag/${v.id}`}
                      className="font-medium text-brk-700 hover:underline"
                    >
                      {v.vertragsnummer ?? v.vorgangsnummer}
                    </Link>
                    {v.vertragsnummer && (
                      <span className="block text-xs text-tinte-500">
                        {v.vorgangsnummer}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-tinte-900">
                      {v.daten.teilnehmer.vorname} {v.daten.teilnehmer.nachname}
                    </span>
                    <span className="block text-xs text-tinte-500">
                      {v.daten.teilnehmer.ort}
                      {v.daten.besteller &&
                        ` · bestellt von ${v.daten.besteller.vorname} ${v.daten.besteller.nachname}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-tinte-700">
                    {paketName(v.paket)}
                    {v.kostenuebernahme && (
                      <span className="ml-1.5 rounded bg-tinte-100 px-1.5 py-0.5 text-xs text-tinte-600">
                        Kasse
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-tinte-900">
                    {euro(v.preis.summe.monatlich)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusZeichen status={v.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-tinte-500">
                    {v.vor_ort_am
                      ? new Date(v.vor_ort_am).toLocaleDateString("de-DE")
                      : "offen"}
                  </td>
                  <td className="px-4 py-3 text-xs text-tinte-500">
                    {new Date(v.erstellt_am).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function paketName(id: string): string {
  try {
    return paketById(id as PaketId).name;
  } catch {
    return id;
  }
}
