import { NextRequest, NextResponse } from "next/server";

import { verlangeRolle } from "@/lib/auth";
import { BUCKET, db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liefert das abgelegte Vertrags-PDF aus dem Storage aus. */
export async function GET(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await verlangeRolle(["admin", "mitarbeiter", "techniker"]);
  const { id } = await params;
  const parameter = anfrage.nextUrl.searchParams;
  const gesamt = parameter.get("gesamt") === "1";
  // Die Fassung, die der Kunde unterschrieben hat – unverändert, auch wenn
  // der Vertrag später im Backoffice nachbearbeitet wurde.
  const original = parameter.get("original") === "1";

  const { data: vertrag } = await db()
    .from("vertraege")
    .select("vorgangsnummer, pdf_pfad, gesamt_pdf_pfad, pdf_original_pfad")
    .eq("id", id)
    .maybeSingle();

  const pfad = original
    ? vertrag?.pdf_original_pfad
    : gesamt
      ? (vertrag?.gesamt_pdf_pfad ?? vertrag?.pdf_pfad)
      : vertrag?.pdf_pfad;
  if (!vertrag || !pfad) {
    return NextResponse.json({ fehler: "Nicht gefunden" }, { status: 404 });
  }

  const { data, error } = await db().storage.from(BUCKET).download(pfad);
  if (error || !data) {
    return NextResponse.json({ fehler: "Ablage nicht erreichbar" }, { status: 502 });
  }

  const zusatz = original
    ? "_Servicevertrag_unterschriebene_Erstfassung"
    : gesamt
      ? "_Gesamtvertrag"
      : "_Servicevertrag";
  const name = `${vertrag.vorgangsnummer}${zusatz}.pdf`;
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
