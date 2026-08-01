import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  fremdeHerkunftAntwort,
  herkunftStimmt,
  imRahmen,
  klientAdresse,
  leseKoerper,
  zuGrossAntwort,
  ZU_GROSS,
} from "@/lib/schutz";
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
  if (!herkunftStimmt(anfrage)) return fremdeHerkunftAntwort();

  const koerper = await leseKoerper(anfrage, 8 * 1024);
  if (koerper === ZU_GROSS) return zuGrossAntwort();

  // Die Trichterzahlen sind nur so viel wert, wie sie echt sind. Ohne Bremse
  // könnte jemand die Auswertung mit erfundenen Schritten unbrauchbar machen.
  if (!(await imRahmen("ereignis", klientAdresse(anfrage)))) {
    return NextResponse.json({ ok: false });
  }

  const geprueft = schema.safeParse(koerper);
  if (!geprueft.success) {
    return NextResponse.json({ fehler: "Ungültige Daten" }, { status: 400 });
  }
  const eingabe = geprueft.data;

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
