import { NextRequest, NextResponse } from "next/server";

import { verlangeRolle } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendeRuecksetzLink } from "@/lib/passwort";

export const runtime = "nodejs";

/**
 * Schickt einem Zugang einen Link zum Setzen eines neuen Passworts.
 *
 * Der Admin sieht das Passwort dabei nie – er stößt nur den Versand an.
 * Anders als bei "Passwort vergessen" darf die Antwort hier ehrlich sein:
 * Wer bis hierher kommt, ist bereits als Administrator angemeldet.
 */
export async function POST(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await verlangeRolle(["admin"]);
  const { id } = await params;

  try {
    const { data: profil } = await db()
      .from("profile")
      .select("name, aktiv")
      .eq("id", id)
      .maybeSingle();
    if (!profil) {
      return NextResponse.json({ fehler: "Dieser Zugang existiert nicht." }, { status: 404 });
    }
    if (!profil.aktiv) {
      return NextResponse.json(
        { fehler: "Der Zugang ist deaktiviert. Bitte ihn zuerst wieder aktivieren." },
        { status: 409 },
      );
    }

    const { data: konto } = await db().auth.admin.getUserById(id);
    const email = konto?.user?.email ?? "";
    if (!email) {
      return NextResponse.json(
        { fehler: "Zu diesem Zugang ist keine E-Mail-Adresse hinterlegt." },
        { status: 409 },
      );
    }

    // Ältere offene Links entwerten, damit nur der neueste gilt.
    await db()
      .from("passwort_anfragen")
      .update({ verwendet_am: new Date().toISOString() })
      .eq("benutzer_id", id)
      .is("verwendet_am", null);

    await sendeRuecksetzLink({
      benutzerId: id,
      email,
      name: (profil.name as string) ?? "",
      art: konto?.user?.last_sign_in_at ? "vergessen" : "einladung",
      basisUrl: process.env.NEXT_PUBLIC_BASIS_URL || anfrage.nextUrl.origin,
    });

    return NextResponse.json({ ok: true, email });
  } catch (fehler) {
    console.error("Rücksetz-Link fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Der Link konnte nicht verschickt werden. Bitte SMTP-Zugang prüfen." },
      { status: 500 },
    );
  }
}
