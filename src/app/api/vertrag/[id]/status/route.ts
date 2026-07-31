import { NextRequest, NextResponse } from "next/server";

import { verlangeRolle } from "@/lib/auth";
import { db } from "@/lib/db";
import { VERTRAGS_STATUS, VertragsStatus } from "@/lib/typen";

export async function POST(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await verlangeRolle(["admin", "mitarbeiter"]);
  const { id } = await params;
  const { status } = await anfrage.json().catch(() => ({}));

  if (!VERTRAGS_STATUS.includes(status as VertragsStatus)) {
    return NextResponse.json({ fehler: "Unbekannter Status" }, { status: 400 });
  }

  const { error } = await db().from("vertraege").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
