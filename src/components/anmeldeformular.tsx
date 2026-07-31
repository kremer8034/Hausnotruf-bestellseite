"use client";

import { useState } from "react";

import { Textfeld } from "./formular";
import { Hinweisbox, Knopf } from "./ui";

export function Anmeldeformular({ hinweis }: { hinweis?: string }) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(hinweis ?? null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      const antwort = await fetch("/api/anmelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, passwort }),
      });
      const ergebnis = await antwort.json();
      if (!antwort.ok) {
        setFehler(ergebnis.fehler ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      window.location.href = ergebnis.ziel;
    } catch {
      setFehler("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      {fehler && <Hinweisbox art="warnung">{fehler}</Hinweisbox>}
      <Textfeld
        etikett="E-Mail-Adresse"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Textfeld
        etikett="Passwort"
        type="password"
        autoComplete="current-password"
        required
        value={passwort}
        onChange={(e) => setPasswort(e.target.value)}
      />
      <Knopf breit type="submit" disabled={laeuft}>
        {laeuft ? "Anmeldung läuft …" : "Anmelden"}
      </Knopf>
    </form>
  );
}
