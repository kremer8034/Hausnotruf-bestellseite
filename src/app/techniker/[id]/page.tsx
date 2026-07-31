import Link from "next/link";
import { notFound } from "next/navigation";

import { Karte } from "@/components/ui";
import { VorOrtFormular } from "@/components/vorortformular";
import { verlangeRolle } from "@/lib/auth";
import { db } from "@/lib/db";
import { PaketId, paketById } from "@/lib/katalog";
import { Bestellung, VorOrtErfassung } from "@/lib/typen";

export const dynamic = "force-dynamic";

export default async function Technikertermin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verlangeRolle(["techniker", "admin", "mitarbeiter"]);
  const { id } = await params;

  const { data } = await db()
    .from("vertraege")
    .select("id, vorgangsnummer, daten, vor_ort, paket")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const b = data.daten as Bestellung;
  const paket = paketById(data.paket as PaketId);

  return (
    <>
      <Link href="/techniker" className="text-sm text-tinte-500 hover:text-brk-700">
        ← Alle Termine
      </Link>

      <h1 className="mt-2 text-xl font-bold text-tinte-900">
        {b.teilnehmer.vorname} {b.teilnehmer.nachname}
      </h1>
      <p className="mt-1 mb-5 text-sm text-tinte-500">
        {data.vorgangsnummer} · {paket.name}
      </p>

      <Karte className="mb-5 bg-tinte-50">
        <h2 className="mb-3 text-sm font-semibold text-tinte-700">Vor dem Termin</h2>
        <dl className="space-y-1.5 text-sm">
          <Zeile
            titel="Anschrift"
            wert={`${b.teilnehmer.strasse}, ${b.teilnehmer.plz} ${b.teilnehmer.ort}`}
          />
          <Zeile titel="Telefon" wert={b.teilnehmer.telefon} />
          {b.besteller && (
            <Zeile
              titel="Ansprechpartner"
              wert={`${b.besteller.vorname} ${b.besteller.nachname}, ${b.besteller.telefon}`}
            />
          )}
          <Zeile
            titel="Anschluss"
            wert={
              {
                gsm: "GSM (SIM-Karte vom BRK)",
                voip: "VoIP über Router",
                msan: "MSAN-POTS",
                unbekannt: "unbekannt – bitte vor Ort prüfen",
              }[b.anschlussart]
            }
          />
          <Zeile titel="Telefonanbieter" wert={b.telefonanbieter || "—"} />
          <Zeile titel="Schlüsseltresor" wert={b.keySafeStandortWunsch || "vor Ort abstimmen"} />
          <Zeile titel="Zugang" wert={b.zugangshinweise || "—"} />
          <Zeile titel="Hinweise" wert={b.notfallhinweise || "—"} />
          <Zeile
            titel="Zusatzleistungen"
            wert={b.optionen.length ? b.optionen.join(", ") : "keine"}
          />
        </dl>
        <a
          href={`/backoffice/vertrag/${id}/pdf`}
          className="mt-4 inline-block text-sm font-medium text-brk-700 hover:underline"
        >
          Unterschriebenen Vertrag ansehen
        </a>
      </Karte>

      <VorOrtFormular
        vertragId={id}
        vorgangsnummer={data.vorgangsnummer}
        bestellung={b}
        vorhanden={data.vor_ort as VorOrtErfassung | null}
        kaufpreisFaellig={paket.kaufpreis !== null}
      />
    </>
  );
}

function Zeile({ titel, wert }: { titel: string; wert: string }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-36 shrink-0 text-tinte-500">{titel}</dt>
      <dd className="min-w-0 flex-1 text-tinte-800">{wert}</dd>
    </div>
  );
}
