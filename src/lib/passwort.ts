import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { db, ladeStammdaten } from "./db";
import { mailVorlage, sendeMail } from "./mail";

/** Wie lange ein Rücksetz-Link gilt. Kurz genug, um Missbrauch zu begrenzen. */
export const GUELTIGKEIT_MINUTEN = 60;

/**
 * Eine Einladung gilt länger: Wer neu angelegt wird, sitzt womöglich gar nicht
 * am Rechner, wenn der Admin den Zugang einrichtet.
 */
export const EINLADUNG_GUELTIGKEIT_MINUTEN = 7 * 24 * 60;

/** Höchstens so viele Anfragen je Zugang und Stunde. */
const ANFRAGEN_PRO_STUNDE = 3;

export const PASSWORT_MINDESTLAENGE = 10;

/**
 * Erzeugt einen Einmal-Token und legt nur dessen Abdruck ab.
 *
 * Das Original geht ausschließlich in die E-Mail. Wer später die Tabelle
 * liest - etwa über eine Sicherung - kann daraus keinen gültigen Link bauen.
 */
export function erzeugeToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: abdruck(token) };
}

export function abdruck(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Vergleich in konstanter Zeit, damit sich der Token nicht erraten lässt. */
export function gleich(a: string, b: string): boolean {
  const links = Buffer.from(a);
  const rechts = Buffer.from(b);
  if (links.length !== rechts.length) return false;
  return timingSafeEqual(links, rechts);
}

export interface PasswortAnfrage {
  id: string;
  benutzer_id: string;
  gueltig_bis: string;
  verwendet_am: string | null;
}

/**
 * Prüft, ob für diesen Zugang in der letzten Stunde schon zu viele Links
 * angefordert wurden. Verhindert, dass jemand fremde Postfächer zumüllt.
 */
export async function zuVieleAnfragen(benutzerId: string): Promise<boolean> {
  const seit = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await db()
    .from("passwort_anfragen")
    .select("id", { count: "exact", head: true })
    .eq("benutzer_id", benutzerId)
    .gt("erstellt_am", seit);
  return (count ?? 0) >= ANFRAGEN_PRO_STUNDE;
}

/** Sucht die Anfrage zu einem Token, sofern sie gültig und unbenutzt ist. */
export async function findeAnfrage(token: string): Promise<PasswortAnfrage | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await db()
    .from("passwort_anfragen")
    .select("id, benutzer_id, gueltig_bis, verwendet_am, token_hash")
    .eq("token_hash", abdruck(token))
    .maybeSingle();
  if (!data) return null;
  if (!gleich(data.token_hash as string, abdruck(token))) return null;
  if (data.verwendet_am) return null;
  if (new Date(data.gueltig_bis as string).getTime() < Date.now()) return null;
  return data as PasswortAnfrage;
}

export type LinkArt = "vergessen" | "einladung";

/**
 * Legt einen Einmal-Link an und verschickt ihn.
 *
 * Sowohl "Passwort vergessen" als auch die Einladung eines neuen Zugangs
 * laufen hier durch. Ein gemeinsamer Weg heißt: Gültigkeit, Abdruck-Ablage
 * und Entwertung können zwischen den beiden nicht auseinanderlaufen.
 */
export async function sendeRuecksetzLink(opt: {
  benutzerId: string;
  email: string;
  name: string;
  art: LinkArt;
  basisUrl: string;
  angefordertVon?: string | null;
}): Promise<void> {
  const einladung = opt.art === "einladung";
  const minuten = einladung ? EINLADUNG_GUELTIGKEIT_MINUTEN : GUELTIGKEIT_MINUTEN;

  const { token, hash } = erzeugeToken();
  const { error } = await db().from("passwort_anfragen").insert({
    benutzer_id: opt.benutzerId,
    token_hash: hash,
    gueltig_bis: new Date(Date.now() + minuten * 60 * 1000).toISOString(),
    angefordert_von: opt.angefordertVon ?? null,
  });
  if (error) throw error;

  const link = `${opt.basisUrl.replace(/\/$/, "")}/passwort-neu?token=${token}`;
  const stammdaten = await ladeStammdaten();
  const frist = einladung ? "sieben Tage" : `${GUELTIGKEIT_MINUTEN} Minuten`;

  const titel = einladung
    ? "Ihr Zugang zum Hausnotruf-Backoffice"
    : "Neues Passwort vergeben";
  const knopf = einladung ? "Passwort festlegen" : "Neues Passwort vergeben";

  const absaetze = [
    `Guten Tag ${opt.name || ""},`.trim(),
    einladung
      ? `für Sie wurde ein Zugang zum Hausnotruf-Backoffice des ${stammdaten.verbandsName} eingerichtet. Bitte legen Sie über den folgenden Link Ihr persönliches Passwort fest:`
      : `für Ihren Zugang zum Hausnotruf-Backoffice wurde ein neues Passwort angefordert. Über den folgenden Link können Sie eines vergeben:`,
    `<a href="${link}" style="display:inline-block;background:#c40004;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${knopf}</a>`,
    `Der Link gilt ${frist} und lässt sich nur einmal verwenden.`,
    einladung
      ? `Anmelden können Sie sich anschließend jederzeit mit dieser E-Mail-Adresse und Ihrem Passwort.`
      : `<strong>Sie haben das nicht angefordert?</strong> Dann ignorieren Sie diese Nachricht. Ihr bisheriges Passwort bleibt gültig. Wenden Sie sich an die Administration, wenn Sie solche Nachrichten häufiger erhalten.`,
    `Falls der Knopf nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:<br><span style="word-break:break-all;color:#64748b">${link}</span>`,
  ];

  await sendeMail({
    an: opt.email,
    betreff: einladung
      ? "Ihr Zugang zum Hausnotruf-Backoffice"
      : "Neues Passwort für das Hausnotruf-Backoffice",
    text: `${
      einladung
        ? "für Sie wurde ein Zugang zum Hausnotruf-Backoffice eingerichtet. Bitte legen Sie über den folgenden Link Ihr Passwort fest."
        : "Für Ihren Zugang wurde ein neues Passwort angefordert."
    }\n\n${link}\n\nDer Link gilt ${frist} und lässt sich nur einmal verwenden.\n\n${stammdaten.verbandsName}`,
    html: mailVorlage(
      titel,
      absaetze,
      `${stammdaten.verbandsName} · ${stammdaten.verbandsAnschrift} · ${stammdaten.telefon}`,
    ),
  });
}

/** Bewertet ein neues Passwort. Liefert null, wenn es in Ordnung ist. */
export function passwortFehler(passwort: string, email: string): string | null {
  if (passwort.length < PASSWORT_MINDESTLAENGE) {
    return `Das Passwort muss mindestens ${PASSWORT_MINDESTLAENGE} Zeichen lang sein.`;
  }
  if (passwort.length > 200) {
    return "Das Passwort ist zu lang.";
  }
  const klein = passwort.toLowerCase();
  const vorEt = email.split("@")[0]?.toLowerCase() ?? "";
  if (vorEt.length >= 4 && klein.includes(vorEt)) {
    return "Das Passwort darf nicht die E-Mail-Adresse enthalten.";
  }
  if (["passwort", "password", "hausnotruf", "12345678"].some((w) => klein.includes(w))) {
    return "Bitte wählen Sie ein Passwort, das kein leicht zu erratendes Wort enthält.";
  }
  return null;
}
