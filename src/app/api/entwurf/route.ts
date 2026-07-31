import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { SCHRITTE } from "@/lib/typen";

/**
 * Zwischenstand der Bestellung speichern und wieder laden.
 *
 * Der Token im Link ist das einzige Geheimnis; er ist 32 Byte lang und wird
 * nur an die vom Kunden angegebene E-Mail-Adresse geschickt. Entwürfe werden
 * nach 30 Tagen automatisch gelöscht (siehe /api/aufraeumen).
 */
const speichernSchema = z.object({
  token: z.string().length(64).optional(),
  sitzungId: z.string().min(8).max(64).optional(),
  schritt: z.enum(SCHRITTE),
  daten: z.record(z.unknown()),
  email: z.string().email().optional().or(z.literal("")),
});

export async function POST(anfrage: NextRequest) {
  let eingabe;
  try {
    eingabe = speichernSchema.parse(await anfrage.json());
  } catch {
    return NextResponse.json({ fehler: "Ungültige Daten" }, { status: 400 });
  }

  // IBAN und Unterschrift gehören nicht in einen Zwischenstand, der über
  // einen Link erreichbar ist. Sie werden erst beim Abschluss übertragen.
  const daten = { ...eingabe.daten };
  delete daten.sepaIban;
  delete daten.unterschrift;

  const satz = {
    schritt: eingabe.schritt,
    daten,
    email: eingabe.email || null,
    sitzung_id: eingabe.sitzungId ?? null,
  };

  try {
    if (eingabe.token) {
      const { data, error } = await db()
        .from("entwuerfe")
        .update(satz)
        .eq("token", eingabe.token)
        .eq("abgeschlossen", false)
        .select("id, token")
        .maybeSingle();
      if (error) throw error;
      if (data) return NextResponse.json({ id: data.id, token: data.token });
      // Token unbekannt oder bereits abgeschlossen: neuen Entwurf anlegen.
    }

    const token = randomBytes(32).toString("hex");
    const { data, error } = await db()
      .from("entwuerfe")
      .insert({ ...satz, token })
      .select("id, token")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, token: data.token });
  } catch (fehler) {
    return NextResponse.json(
      { fehler: (fehler as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(anfrage: NextRequest) {
  const token = anfrage.nextUrl.searchParams.get("token");
  if (!token || token.length !== 64) {
    return NextResponse.json({ fehler: "Kein gültiger Link" }, { status: 400 });
  }
  const { data, error } = await db()
    .from("entwuerfe")
    .select("id, token, schritt, daten, email, abgeschlossen")
    .eq("token", token)
    .maybeSingle();
  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });
  if (!data || data.abgeschlossen) {
    return NextResponse.json({ fehler: "Dieser Link ist nicht mehr gültig." }, { status: 404 });
  }
  return NextResponse.json(data);
}
