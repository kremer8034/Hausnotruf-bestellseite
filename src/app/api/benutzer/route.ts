import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verlangeRolle } from "@/lib/auth";
import { ladeBenutzer } from "@/lib/benutzer";
import { db } from "@/lib/db";
import { passwortFehler, sendeRuecksetzLink } from "@/lib/passwort";

export const runtime = "nodejs";

const anlegenSchema = z.object({
  email: z.string().trim().toLowerCase().email("Die E-Mail-Adresse ist nicht gültig."),
  name: z.string().trim().min(2, "Bitte den Namen angeben.").max(120),
  rolle: z.enum(["admin", "mitarbeiter", "techniker"]),
  // Entweder ein Einladungslink oder ein vom Admin gesetztes Startpasswort.
  einladen: z.boolean().default(true),
  passwort: z.string().optional(),
});

export async function GET() {
  await verlangeRolle(["admin"]);
  try {
    return NextResponse.json({ benutzer: await ladeBenutzer() });
  } catch (fehler) {
    console.error("Benutzerliste fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Die Zugänge konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function POST(anfrage: NextRequest) {
  await verlangeRolle(["admin"]);

  const eingabe = anlegenSchema.safeParse(await anfrage.json().catch(() => null));
  if (!eingabe.success) {
    const erster = eingabe.error.errors[0];
    return NextResponse.json(
      { fehler: erster?.message ?? "Ungültige Angaben.", feld: erster?.path[0] },
      { status: 422 },
    );
  }
  const { email, name, rolle, einladen } = eingabe.data;
  const passwort = eingabe.data.passwort ?? "";

  if (!einladen) {
    const schwach = passwortFehler(passwort, email);
    if (schwach) return NextResponse.json({ fehler: schwach, feld: "passwort" }, { status: 422 });
  }

  let angelegt: string | null = null;
  try {
    // Bei der Einladung setzen wir ein Zufallspasswort, das niemand kennt:
    // Supabase verlangt eines, benutzt wird ausschließlich der Link.
    const { data, error } = await db().auth.admin.createUser({
      email,
      password: einladen ? crypto.randomUUID() + crypto.randomUUID() : passwort,
      email_confirm: true,
    });
    if (error || !data.user) {
      const text = (error?.message ?? "").toLowerCase();
      if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
        return NextResponse.json(
          { fehler: "Zu dieser E-Mail-Adresse gibt es bereits einen Zugang.", feld: "email" },
          { status: 409 },
        );
      }
      throw error ?? new Error("Zugang konnte nicht angelegt werden.");
    }
    angelegt = data.user.id;

    const { error: profilFehler } = await db()
      .from("profile")
      .insert({ id: data.user.id, name, rolle, aktiv: true });
    if (profilFehler) throw profilFehler;

    // Ab hier steht der Zugang. Scheitert nur noch die E-Mail, bleibt er
    // bestehen – der Admin kann den Link dann erneut verschicken.
    let mailFehler: string | null = null;
    if (einladen) {
      try {
        await sendeRuecksetzLink({
          benutzerId: data.user.id,
          email,
          name,
          art: "einladung",
          basisUrl: process.env.NEXT_PUBLIC_BASIS_URL || anfrage.nextUrl.origin,
        });
      } catch (fehler) {
        console.error("Einladung konnte nicht verschickt werden:", fehler);
        mailFehler =
          "Der Zugang wurde angelegt, die Einladung konnte aber nicht verschickt werden. Bitte den Link über „Passwort zurücksetzen“ erneut senden.";
      }
    }

    return NextResponse.json({ ok: true, id: data.user.id, warnung: mailFehler });
  } catch (fehler) {
    // Halb angelegte Zugänge wieder entfernen, sonst blockiert die Adresse
    // einen zweiten Versuch.
    if (angelegt) {
      await db().auth.admin.deleteUser(angelegt).catch(() => undefined);
    }
    console.error("Zugang anlegen fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Der Zugang konnte nicht angelegt werden. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
