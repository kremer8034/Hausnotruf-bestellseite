"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Textfeld } from "./formular";
import { Hinweisbox, Knopf } from "./ui";

/** Muss zur Prüfung im Server übereinstimmen. */
const MINDESTLAENGE = 10;

export function PasswortVergessenFormular() {
  const [email, setEmail] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [gesendet, setGesendet] = useState<string | null>(null);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const antwort = await fetch("/api/passwort/anfordern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const ergebnis = await antwort.json();
      setGesendet(
        ergebnis.hinweis ??
          "Wenn zu dieser Adresse ein Zugang besteht, ist eine E-Mail unterwegs.",
      );
    } catch {
      setGesendet(
        "Wenn zu dieser Adresse ein Zugang besteht, ist eine E-Mail unterwegs.",
      );
    } finally {
      setLaeuft(false);
    }
  }

  if (gesendet) {
    return (
      <div className="space-y-4">
        <Hinweisbox>{gesendet}</Hinweisbox>
        <p className="text-sm text-tinte-600">
          Schauen Sie auch im Spam-Ordner nach. Der Link gilt eine Stunde und lässt
          sich nur einmal verwenden.
        </p>
        <Link href="/anmelden" className="block">
          <Knopf art="neben" breit type="button">
            Zurück zur Anmeldung
          </Knopf>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      <p className="text-sm text-tinte-600">
        Geben Sie die E-Mail-Adresse Ihres Zugangs an. Wir schicken Ihnen einen Link,
        über den Sie ein neues Passwort vergeben können.
      </p>
      <Textfeld
        etikett="E-Mail-Adresse"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Knopf breit type="submit" disabled={laeuft}>
        {laeuft ? "Wird gesendet …" : "Link anfordern"}
      </Knopf>
      <Link
        href="/anmelden"
        className="block text-center text-sm text-tinte-500 hover:text-brk-700"
      >
        Zurück zur Anmeldung
      </Link>
    </form>
  );
}

export function PasswortNeuFormular({ token }: { token: string }) {
  const [passwort, setPasswort] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [pruefung, setPruefung] = useState<"laeuft" | "gueltig" | "ungueltig">("laeuft");

  // Vorab prüfen, damit niemand erst ein Passwort tippt und dann erfährt,
  // dass der Link abgelaufen ist.
  useEffect(() => {
    fetch(`/api/passwort/neu?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((e) => setPruefung(e.gueltig ? "gueltig" : "ungueltig"))
      .catch(() => setPruefung("ungueltig"));
  }, [token]);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (passwort !== wiederholung) {
      setFehler("Die beiden Eingaben stimmen nicht überein.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      const antwort = await fetch("/api/passwort/neu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, passwort }),
      });
      const ergebnis = await antwort.json();
      if (!antwort.ok) {
        setFehler(ergebnis.fehler ?? "Das Passwort konnte nicht geändert werden.");
        return;
      }
      setFertig(true);
    } catch {
      setFehler("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLaeuft(false);
    }
  }

  if (pruefung === "laeuft") {
    return <p className="text-sm text-tinte-500">Der Link wird geprüft …</p>;
  }

  if (pruefung === "ungueltig") {
    return (
      <div className="space-y-4">
        <Hinweisbox art="warnung">
          Dieser Link ist abgelaufen oder wurde bereits verwendet.
        </Hinweisbox>
        <Link href="/passwort-vergessen" className="block">
          <Knopf breit type="button">
            Neuen Link anfordern
          </Knopf>
        </Link>
      </div>
    );
  }

  if (fertig) {
    return (
      <div className="space-y-4">
        <Hinweisbox>
          Ihr Passwort wurde geändert. Bestehende Anmeldungen an anderen Geräten
          wurden beendet.
        </Hinweisbox>
        <Link href="/anmelden" className="block">
          <Knopf breit type="button">
            Jetzt anmelden
          </Knopf>
        </Link>
      </div>
    );
  }

  const zuKurz = passwort.length > 0 && passwort.length < MINDESTLAENGE;
  const ungleich = wiederholung.length > 0 && passwort !== wiederholung;

  return (
    <form onSubmit={absenden} className="space-y-4">
      {fehler && <Hinweisbox art="warnung">{fehler}</Hinweisbox>}
      <Textfeld
        etikett="Neues Passwort"
        type="password"
        autoComplete="new-password"
        required
        hinweis={`Mindestens ${MINDESTLAENGE} Zeichen.`}
        fehler={zuKurz ? `Noch zu kurz – mindestens ${MINDESTLAENGE} Zeichen.` : undefined}
        value={passwort}
        onChange={(e) => setPasswort(e.target.value)}
      />
      <Textfeld
        etikett="Passwort wiederholen"
        type="password"
        autoComplete="new-password"
        required
        fehler={ungleich ? "Die beiden Eingaben stimmen nicht überein." : undefined}
        value={wiederholung}
        onChange={(e) => setWiederholung(e.target.value)}
      />
      <Knopf
        breit
        type="submit"
        disabled={laeuft || passwort.length < MINDESTLAENGE || passwort !== wiederholung}
      >
        {laeuft ? "Wird gespeichert …" : "Passwort speichern"}
      </Knopf>
    </form>
  );
}
