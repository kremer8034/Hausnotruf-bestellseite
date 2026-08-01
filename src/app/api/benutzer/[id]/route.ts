import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verlangeRolle } from "@/lib/auth";
import { aktiveAdminsAusser, hatErfassungen } from "@/lib/benutzer";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const aendernSchema = z.object({
  name: z.string().trim().min(2, "Bitte den Namen angeben.").max(120).optional(),
  rolle: z.enum(["admin", "mitarbeiter", "techniker"]).optional(),
  aktiv: z.boolean().optional(),
});

export async function PATCH(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verlangeRolle(["admin"]);
  const { id } = await params;

  const eingabe = aendernSchema.safeParse(await anfrage.json().catch(() => null));
  if (!eingabe.success) {
    return NextResponse.json(
      { fehler: eingabe.error.errors[0]?.message ?? "Ungültige Angaben." },
      { status: 422 },
    );
  }
  const { name, rolle, aktiv } = eingabe.data;

  // Sich selbst die Rechte zu nehmen, sperrt einen aus dem Backoffice aus –
  // und niemand könnte es rückgängig machen.
  if (id === admin.id && rolle && rolle !== "admin") {
    return NextResponse.json(
      { fehler: "Sie können sich die eigene Administratorrolle nicht entziehen." },
      { status: 409 },
    );
  }
  if (id === admin.id && aktiv === false) {
    return NextResponse.json(
      { fehler: "Sie können den eigenen Zugang nicht deaktivieren." },
      { status: 409 },
    );
  }

  try {
    const { data: bisher } = await db()
      .from("profile")
      .select("rolle, aktiv")
      .eq("id", id)
      .maybeSingle();
    if (!bisher) {
      return NextResponse.json({ fehler: "Dieser Zugang existiert nicht." }, { status: 404 });
    }

    // Verliert der letzte aktive Administrator seine Rolle, kommt niemand mehr
    // an Einstellungen und Benutzerverwaltung.
    const verliertAdmin =
      bisher.rolle === "admin" &&
      bisher.aktiv &&
      ((rolle && rolle !== "admin") || aktiv === false);
    if (verliertAdmin && (await aktiveAdminsAusser(id)) === 0) {
      return NextResponse.json(
        {
          fehler:
            "Das ist der letzte aktive Administrator. Bitte zuerst einen weiteren Administrator anlegen.",
        },
        { status: 409 },
      );
    }

    const aenderung: Record<string, unknown> = {};
    if (name !== undefined) aenderung.name = name;
    if (rolle !== undefined) aenderung.rolle = rolle;
    if (aktiv !== undefined) aenderung.aktiv = aktiv;
    if (Object.keys(aenderung).length === 0) return NextResponse.json({ ok: true });

    const { error } = await db().from("profile").update(aenderung).eq("id", id);
    if (error) throw error;

    // Wer deaktiviert wird, soll nicht mit einer offenen Sitzung weiterarbeiten.
    if (aktiv === false) {
      try {
        await db().rpc("beende_sitzungen", { p_benutzer: id });
      } catch (fehler) {
        console.error("Sitzungen beenden fehlgeschlagen:", fehler);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (fehler) {
    console.error("Zugang ändern fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Die Änderung konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verlangeRolle(["admin"]);
  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json(
      { fehler: "Sie können den eigenen Zugang nicht löschen." },
      { status: 409 },
    );
  }

  try {
    const { data: bisher } = await db()
      .from("profile")
      .select("rolle, aktiv")
      .eq("id", id)
      .maybeSingle();
    if (!bisher) {
      return NextResponse.json({ fehler: "Dieser Zugang existiert nicht." }, { status: 404 });
    }
    if (bisher.rolle === "admin" && bisher.aktiv && (await aktiveAdminsAusser(id)) === 0) {
      return NextResponse.json(
        {
          fehler:
            "Das ist der letzte aktive Administrator und kann nicht gelöscht werden.",
        },
        { status: 409 },
      );
    }

    // Erfasste Installationen hängen am Zugang. Sie zu verlieren hieße, den
    // Nachweis zu verlieren, wer das Gerät angeschlossen hat.
    if (await hatErfassungen(id)) {
      return NextResponse.json(
        {
          fehler:
            "Dieser Zugang hat Installationen erfasst und bleibt als Nachweis erhalten. Bitte stattdessen deaktivieren.",
        },
        { status: 409 },
      );
    }

    // Das Profil hängt per Fremdschlüssel an auth.users und geht mit.
    const { error } = await db().auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (fehler) {
    console.error("Zugang löschen fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Der Zugang konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }
}
