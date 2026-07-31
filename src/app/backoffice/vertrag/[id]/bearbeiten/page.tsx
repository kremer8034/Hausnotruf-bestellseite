import Link from "next/link";
import { notFound } from "next/navigation";

import { Vertragsformular } from "@/components/vertragsformular";
import { verlangeRolle } from "@/lib/auth";
import { db } from "@/lib/db";
import { Bestellung } from "@/lib/typen";
import { empfaengerAdresse } from "@/lib/vertrag";

export const dynamic = "force-dynamic";

export default async function VertragBearbeiten({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verlangeRolle(["admin", "mitarbeiter"]);
  const { id } = await params;

  const { data } = await db()
    .from("vertraege")
    .select("id, vorgangsnummer, vertragsnummer, daten, notiz")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const bestellung = data.daten as Bestellung;

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/backoffice/vertrag/${id}`}
          className="text-sm text-tinte-500 hover:text-brk-700"
        >
          ← Zurück zum Vertrag
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-tinte-900">
          {data.vorgangsnummer} bearbeiten
        </h1>
        <p className="mt-1 text-sm text-tinte-500">
          {bestellung.teilnehmer.vorname} {bestellung.teilnehmer.nachname}
        </p>
      </div>

      <Vertragsformular
        id={id}
        vorgangsnummer={data.vorgangsnummer}
        vertragsnummer={data.vertragsnummer ?? ""}
        bestellung={bestellung}
        notiz={data.notiz ?? ""}
        hatEmail={Boolean(empfaengerAdresse(bestellung))}
      />
    </>
  );
}
