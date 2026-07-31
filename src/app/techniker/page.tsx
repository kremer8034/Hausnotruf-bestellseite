import Link from "next/link";

import { Karte } from "@/components/ui";
import { db } from "@/lib/db";
import { PaketId, paketById } from "@/lib/katalog";
import { Bestellung } from "@/lib/typen";

export const dynamic = "force-dynamic";

interface Zeile {
  id: string;
  vorgangsnummer: string;
  erstellt_am: string;
  vor_ort_am: string | null;
  paket: string;
  daten: Bestellung;
}

export default async function Technikerliste() {
  const { data } = await db()
    .from("vertraege")
    .select("id, vorgangsnummer, erstellt_am, vor_ort_am, paket, daten")
    .neq("status", "gekuendigt")
    .order("erstellt_am", { ascending: true })
    .limit(100);

  const alle = (data ?? []) as unknown as Zeile[];
  const offen = alle.filter((v) => !v.vor_ort_am);
  const erledigt = alle.filter((v) => v.vor_ort_am).slice(0, 10);

  return (
    <>
      <h1 className="text-xl font-bold text-tinte-900">Installationen</h1>
      <p className="mt-1 mb-5 text-sm text-tinte-500">
        {offen.length === 0
          ? "Aktuell ist keine Installation offen."
          : `${offen.length} Termin${offen.length === 1 ? "" : "e"} offen`}
      </p>

      <div className="space-y-3">
        {offen.map((v) => (
          <Link key={v.id} href={`/techniker/${v.id}`} className="block">
            <Karte className="transition hover:border-brk-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-tinte-900">
                    {v.daten.teilnehmer.vorname} {v.daten.teilnehmer.nachname}
                  </p>
                  <p className="mt-0.5 text-sm text-tinte-600">
                    {v.daten.teilnehmer.strasse}, {v.daten.teilnehmer.plz}{" "}
                    {v.daten.teilnehmer.ort}
                  </p>
                  <p className="mt-1 text-sm text-tinte-500">
                    {v.daten.teilnehmer.telefon}
                  </p>
                  <p className="mt-2 text-xs text-tinte-500">
                    {v.vorgangsnummer} · {paketName(v.paket)}
                    {v.daten.besteller &&
                      ` · Ansprechpartner ${v.daten.besteller.vorname} ${v.daten.besteller.nachname}, ${v.daten.besteller.telefon}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-brk-50 px-2.5 py-1 text-xs font-medium text-brk-700">
                  offen
                </span>
              </div>
            </Karte>
          </Link>
        ))}
      </div>

      {erledigt.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold text-tinte-600">
            Zuletzt erledigt
          </h2>
          <div className="space-y-2">
            {erledigt.map((v) => (
              <Link key={v.id} href={`/techniker/${v.id}`} className="block">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-tinte-200 bg-white px-4 py-3 text-sm transition hover:border-tinte-300">
                  <span className="min-w-0 truncate">
                    <span className="text-tinte-800">
                      {v.daten.teilnehmer.vorname} {v.daten.teilnehmer.nachname}
                    </span>
                    <span className="ml-2 text-xs text-tinte-500">
                      {v.vorgangsnummer}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-tinte-500">
                    {new Date(v.vor_ort_am!).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
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
