import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db, ladeStammdaten } from "@/lib/db";
import { mailVorlage, sendeMail } from "@/lib/mail";
import { findeAnfrage, passwortFehler } from "@/lib/passwort";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, "Der Link ist nicht vollständig."),
  passwort: z.string(),
});

const ABGELAUFEN =
  "Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie einen neuen an.";

export async function POST(anfrage: NextRequest) {
  const eingabe = schema.safeParse(await anfrage.json().catch(() => null));
  if (!eingabe.success) {
    return NextResponse.json({ fehler: ABGELAUFEN }, { status: 400 });
  }

  try {
    const vorgang = await findeAnfrage(eingabe.data.token);
    if (!vorgang) {
      return NextResponse.json({ fehler: ABGELAUFEN }, { status: 400 });
    }

    const { data: benutzer } = await db().auth.admin.getUserById(vorgang.benutzer_id);
    const email = benutzer?.user?.email ?? "";
    if (!email) {
      return NextResponse.json({ fehler: ABGELAUFEN }, { status: 400 });
    }

    const schwach = passwortFehler(eingabe.data.passwort, email);
    if (schwach) {
      return NextResponse.json({ fehler: schwach, feld: "passwort" }, { status: 422 });
    }

    const { error: authFehler } = await db().auth.admin.updateUserById(
      vorgang.benutzer_id,
      { password: eingabe.data.passwort },
    );
    if (authFehler) throw authFehler;

    // Erst danach als verwendet markieren: schlägt die Änderung fehl, soll
    // der Link weiterhin gelten.
    await db()
      .from("passwort_anfragen")
      .update({ verwendet_am: new Date().toISOString() })
      .eq("id", vorgang.id);

    // Alle offenen Anfragen dieses Zugangs entwerten – ein zweiter, älterer
    // Link darf nach der Änderung nicht mehr funktionieren.
    await db()
      .from("passwort_anfragen")
      .update({ verwendet_am: new Date().toISOString() })
      .eq("benutzer_id", vorgang.benutzer_id)
      .is("verwendet_am", null);

    // Bestehende Anmeldungen beenden, sonst bliebe jemand eingeloggt, obwohl
    // das Passwort gewechselt wurde.
    try {
      await db().rpc("beende_sitzungen", { p_benutzer: vorgang.benutzer_id });
    } catch (fehler) {
      console.error("Sitzungen beenden fehlgeschlagen:", fehler);
    }

    // Hinweis an den Zugang – so fällt es auf, wenn jemand Fremdes das Passwort
    // geändert hat.
    try {
      const stammdaten = await ladeStammdaten();
      await sendeMail({
        an: email,
        betreff: "Ihr Passwort wurde geändert",
        text: `Das Passwort für Ihren Zugang zum Hausnotruf-Backoffice wurde soeben geändert.\n\nWaren Sie das nicht? Dann wenden Sie sich bitte umgehend an die Administration: ${stammdaten.telefon}.`,
        html: mailVorlage(
          "Ihr Passwort wurde geändert",
          [
            `Das Passwort für Ihren Zugang zum Hausnotruf-Backoffice wurde soeben geändert. Alle bestehenden Anmeldungen wurden dabei beendet.`,
            `<strong>Waren Sie das nicht?</strong> Dann wenden Sie sich bitte umgehend an die Administration: ${stammdaten.telefon}.`,
          ],
          `${stammdaten.verbandsName} · ${stammdaten.telefon}`,
        ),
      });
    } catch (fehler) {
      console.error("Bestätigungsmail fehlgeschlagen:", fehler);
    }

    return NextResponse.json({ ok: true });
  } catch (fehler) {
    console.error("Passwort setzen fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Das Passwort konnte nicht geändert werden. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}

/** Prüft, ob ein Link noch gilt – für die Anzeige der Seite. */
export async function GET(anfrage: NextRequest) {
  const token = anfrage.nextUrl.searchParams.get("token") ?? "";
  const vorgang = await findeAnfrage(token).catch(() => null);
  return NextResponse.json({ gueltig: Boolean(vorgang) });
}
