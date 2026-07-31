import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { SCHRITTE } from "@/lib/typen";

/**
 * Nimmt anonyme Schrittereignisse für die Trichteransicht entgegen.
 *
 * Bewusst ohne IP-Adresse und ohne Cookie: die Sitzungskennung wird im
 * sessionStorage des Browsers erzeugt und verschwindet mit dem Tab.
 */
const schema = z.object({
  sitzungId: z.string().min(8).max(64),
  entwurfId: z.string().uuid().optional(),
  schritt: z.enum(SCHRITTE),
  art: z.enum(["angesehen", "abgeschlossen", "abgebrochen"]),
  geraet: z.enum(["handy", "tablet", "rechner"]).optional(),
  quelle: z.string().max(120).optional(),
});

export async function POST(anfrage: NextRequest) {
  let eingabe;
  try {
    eingabe = schema.parse(await anfrage.json());
  } catch {
    return NextResponse.json({ fehler: "Ungültige Daten" }, { status: 400 });
  }

  try {
    await db().from("ereignisse").insert({
      sitzung_id: eingabe.sitzungId,
      entwurf_id: eingabe.entwurfId ?? null,
      schritt: eingabe.schritt,
      art: eingabe.art,
      geraet: eingabe.geraet ?? null,
      quelle: eingabe.quelle ?? null,
    });
  } catch {
    // Die Auswertung darf die Bestellung nie behindern.
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}
