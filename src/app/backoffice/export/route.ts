import { NextRequest, NextResponse } from "next/server";

import { verlangeRolle } from "@/lib/auth";
import { alsCsv, VertragsZeile } from "@/lib/csv";
import { db } from "@/lib/db";
import { VERTRAGS_STATUS, VertragsStatus } from "@/lib/typen";

export const dynamic = "force-dynamic";

export async function GET(anfrage: NextRequest) {
  await verlangeRolle(["admin", "mitarbeiter"]);

  const status = anfrage.nextUrl.searchParams.get("status");
  let abfrage = db()
    .from("vertraege")
    .select(
      "vorgangsnummer, status, erstellt_am, unterschrift_zeit, unterschrift_ip, vor_ort_am, daten, vor_ort, preis",
    )
    .order("erstellt_am", { ascending: false });

  if (status && VERTRAGS_STATUS.includes(status as VertragsStatus)) {
    abfrage = abfrage.eq("status", status);
  }

  const { data, error } = await abfrage;
  if (error) {
    return NextResponse.json({ fehler: error.message }, { status: 500 });
  }

  const csv = alsCsv((data ?? []) as unknown as VertragsZeile[]);
  const heute = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hausnotruf-vertraege-${heute}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
