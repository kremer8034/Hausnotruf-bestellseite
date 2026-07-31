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
  const gesamt = anfrage.nextUrl.searchParams.get("gesamt") === "1";

  const { data: vertrag } = await db()
    .from("vertraege")
    .select("vorgangsnummer, pdf_pfad, gesamt_pdf_pfad")
    .eq("id", id)
    .maybeSingle();

  const pfad = gesamt ? vertrag?.gesamt_pdf_pfad : vertrag?.pdf_pfad;
  if (!vertrag || !pfad) {
    return NextResponse.json({ fehler: "Nicht gefunden" }, { status: 404 });
  }

  const { data, error } = await db().storage.from(BUCKET).download(pfad);
  if (error || !data) {
    return NextResponse.json({ fehler: "Ablage nicht erreichbar" }, { status: 502 });
  }

  const name = `${vertrag.vorgangsnummer}${gesamt ? "_Gesamtvertrag" : "_Servicevertrag"}.pdf`;
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
