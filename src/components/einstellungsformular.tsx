"use client";

import { useState } from "react";

import type { SmtpEinstellungen } from "@/lib/db";
import type { Stammdaten } from "@/lib/stammdaten";

import { Kontrollkaestchen, Textbereich, Textfeld } from "./formular";
import { Hinweisbox, Karte, Knopf } from "./ui";

/** Das Passwort wird maskiert geladen; dieser Wert bedeutet "unverändert lassen". */
const UNVERAENDERT = "········";

export function Einstellungsformular({
  stammdaten,
  smtp,
}: {
  stammdaten: Stammdaten;
  smtp: SmtpEinstellungen;
}) {
  const [s, setS] = useState(stammdaten);
  const [m, setM] = useState(smtp);
  const [meldung, setMeldung] = useState<{ art: "info" | "warnung"; text: string } | null>(
    null,
  );
  const [laeuft, setLaeuft] = useState(false);

  const setzeS = (feld: keyof Stammdaten, wert: string | string[]) =>
    setS((alt) => ({ ...alt, [feld]: wert }));

  async function speichern() {
    setLaeuft(true);
    setMeldung(null);
    try {
      const antwort = await fetch("/api/einstellungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stammdaten: s,
          // Unverändertes Passwort nicht mitschicken, sonst überschreibt
          // die Maskierung den echten Wert.
          smtp: m.passwort === UNVERAENDERT ? { ...m, passwort: undefined } : m,
        }),
      });
      const ergebnis = await antwort.json();
      if (!antwort.ok) throw new Error(ergebnis.fehler ?? "Speichern fehlgeschlagen");
      setMeldung({ art: "info", text: "Gespeichert." });
    } catch (fehler) {
      setMeldung({ art: "warnung", text: (fehler as Error).message });
    } finally {
      setLaeuft(false);
    }
  }

  async function testeSmtp() {
    setLaeuft(true);
    setMeldung(null);
    try {
      const antwort = await fetch("/api/einstellungen/smtp-test", { method: "POST" });
      const ergebnis = await antwort.json();
      setMeldung(
        antwort.ok
          ? { art: "info", text: "Der SMTP-Zugang funktioniert." }
          : { art: "warnung", text: `SMTP-Test fehlgeschlagen: ${ergebnis.fehler}` },
      );
    } catch {
      setMeldung({ art: "warnung", text: "SMTP-Test konnte nicht ausgeführt werden." });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {meldung && <Hinweisbox art={meldung.art}>{meldung.text}</Hinweisbox>}

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Kreisverband</h2>
        <div className="space-y-4">
          <Textfeld
            etikett="Verbandsname"
            value={s.verbandsName}
            onChange={(e) => setzeS("verbandsName", e.target.value)}
          />
          <Textfeld
            etikett="Anschrift"
            value={s.verbandsAnschrift}
            onChange={(e) => setzeS("verbandsAnschrift", e.target.value)}
          />
          <Textfeld
            etikett="Vertreten durch"
            value={s.vertretenDurch}
            onChange={(e) => setzeS("vertretenDurch", e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Textfeld
              etikett="Telefon"
              value={s.telefon}
              onChange={(e) => setzeS("telefon", e.target.value)}
            />
            <Textfeld
              etikett="Fax"
              value={s.fax}
              onChange={(e) => setzeS("fax", e.target.value)}
            />
            <Textfeld
              etikett="E-Mail"
              value={s.email}
              onChange={(e) => setzeS("email", e.target.value)}
            />
          </div>
          <Textfeld
            etikett="Hausnotrufbeauftragter"
            hinweis="Erscheint auf Seite 1 des Vertrags und auf der Startseite."
            value={s.hausnotrufbeauftragter}
            onChange={(e) => setzeS("hausnotrufbeauftragter", e.target.value)}
          />
          <Textfeld
            etikett="Adresse des Impressums"
            hinweis="Wird in der Fußzeile verlinkt."
            value={s.impressumUrl}
            onChange={(e) => setzeS("impressumUrl", e.target.value)}
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">
          Abrechnung und Kassenverkehr
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="IK-Nummer des Leistungserbringers"
              hinweis="Neunstellig. Erscheint auf Anlage 8 und 9."
              value={s.ik}
              onChange={(e) => setzeS("ik", e.target.value)}
            />
            <Textfeld
              etikett="SEPA-Gläubiger-Identifikationsnummer"
              hinweis="18 Zeichen, beginnt mit DE."
              value={s.glaeubigerId}
              onChange={(e) => setzeS("glaeubigerId", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Vorabinformation der Lastschrift (Tage)"
              inputMode="numeric"
              value={s.sepaFristTage}
              onChange={(e) => setzeS("sepaFristTage", e.target.value)}
            />
            <Textfeld
              etikett="Region für Mobilruf"
              value={s.mobilrufRegion}
              onChange={(e) => setzeS("mobilrufRegion", e.target.value)}
            />
          </div>
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Datenschutz</h2>
        <div className="space-y-4">
          <Textfeld
            etikett="Datenschutzbeauftragter"
            value={s.datenschutzbeauftragter}
            onChange={(e) => setzeS("datenschutzbeauftragter", e.target.value)}
          />
          <Textfeld
            etikett="Aufsichtsbehörde"
            value={s.aufsichtsbehoerde}
            onChange={(e) => setzeS("aufsichtsbehoerde", e.target.value)}
          />
          <Textbereich
            etikett="Entbindung von der Schweigepflicht"
            hinweis="Eine Zeile je Empfänger, höchstens sieben. Erscheint auf Anlage 6."
            rows={7}
            value={s.schweigepflichtentbindung.join("\n")}
            onChange={(e) =>
              setzeS(
                "schweigepflichtentbindung",
                e.target.value.split("\n").slice(0, 7),
              )
            }
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-1 text-base font-bold text-tinte-900">E-Mail-Versand</h2>
        <p className="mb-4 text-sm text-tinte-500">
          Über diesen Zugang verschickt die Seite die Verträge.
        </p>
        <div className="space-y-4">
          <Textfeld
            etikett="Empfänger im Backoffice"
            hinweis="An diese Adresse geht jeder abgeschlossene Vertrag."
            value={s.backofficeEmail}
            onChange={(e) => setzeS("backofficeEmail", e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Textfeld
              etikett="SMTP-Server"
              placeholder="z. B. mail.brk.de"
              value={m.host}
              onChange={(e) => setM({ ...m, host: e.target.value })}
            />
            <Textfeld
              etikett="Port"
              inputMode="numeric"
              value={String(m.port)}
              onChange={(e) => setM({ ...m, port: Number(e.target.value) || 587 })}
            />
          </div>
          <Kontrollkaestchen
            etikett="Verschlüsselte Verbindung ab Verbindungsaufbau (SSL/TLS, meist Port 465)"
            hinweis="Bei Port 587 mit STARTTLS bleibt dieses Feld leer."
            checked={m.sicher}
            onChange={(e) => setM({ ...m, sicher: e.target.checked })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Benutzername"
              autoComplete="off"
              value={m.benutzer}
              onChange={(e) => setM({ ...m, benutzer: e.target.value })}
            />
            <Textfeld
              etikett="Passwort"
              type="password"
              autoComplete="new-password"
              hinweis="Leer lassen, um das gespeicherte Passwort zu behalten."
              value={m.passwort}
              onChange={(e) => setM({ ...m, passwort: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Absendername"
              value={m.absenderName}
              onChange={(e) => setM({ ...m, absenderName: e.target.value })}
            />
            <Textfeld
              etikett="Absenderadresse"
              value={m.absenderAdresse}
              onChange={(e) => setM({ ...m, absenderAdresse: e.target.value })}
            />
          </div>
          <Knopf art="neben" type="button" onClick={testeSmtp} disabled={laeuft}>
            Verbindung testen
          </Knopf>
        </div>
      </Karte>

      <div className="flex justify-end">
        <Knopf type="button" onClick={speichern} disabled={laeuft}>
          {laeuft ? "Wird gespeichert …" : "Einstellungen speichern"}
        </Knopf>
      </div>
    </div>
  );
}
