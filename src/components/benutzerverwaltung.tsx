"use client";

import { useState } from "react";

import type { Benutzerzeile } from "@/lib/benutzer";
import { ROLLEN, rollenName, type Rolle } from "@/lib/rollen";

import { Auswahlfeld, Kontrollkaestchen, Textfeld } from "./formular";
import { Hinweisbox, Karte, Knopf } from "./ui";

type Meldung = { art: "info" | "warnung"; text: string } | null;

const ROLLENFARBE: Record<Rolle, string> = {
  admin: "bg-brk-50 text-brk-800 border-brk-200",
  mitarbeiter: "bg-tinte-100 text-tinte-700 border-tinte-200",
  techniker: "bg-tinte-100 text-tinte-700 border-tinte-200",
};

function datum(wert: string | null): string {
  if (!wert) return "–";
  return new Date(wert).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function Benutzerverwaltung({
  benutzer,
  eigeneId,
}: {
  benutzer: Benutzerzeile[];
  eigeneId: string;
}) {
  const [liste, setListe] = useState(benutzer);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);

  async function neuLaden() {
    const antwort = await fetch("/api/benutzer");
    if (antwort.ok) setListe((await antwort.json()).benutzer as Benutzerzeile[]);
  }

  /** Ein Aufruf mit einheitlicher Fehlerbehandlung – spart Wiederholung. */
  async function ruf(
    id: string,
    pfad: string,
    methode: string,
    koerper?: unknown,
  ): Promise<Record<string, unknown> | null> {
    setLaeuft(id);
    setMeldung(null);
    try {
      const antwort = await fetch(pfad, {
        method: methode,
        headers: koerper ? { "Content-Type": "application/json" } : undefined,
        body: koerper ? JSON.stringify(koerper) : undefined,
      });
      const ergebnis = (await antwort.json().catch(() => ({}))) as Record<string, unknown>;
      if (!antwort.ok) {
        setMeldung({
          art: "warnung",
          text: (ergebnis.fehler as string) ?? "Die Aktion ist fehlgeschlagen.",
        });
        return null;
      }
      return ergebnis;
    } catch {
      setMeldung({ art: "warnung", text: "Keine Verbindung zum Server." });
      return null;
    } finally {
      setLaeuft(null);
    }
  }

  async function speichere(z: Benutzerzeile, aenderung: { name?: string; rolle?: Rolle }) {
    const ergebnis = await ruf(z.id, `/api/benutzer/${z.id}`, "PATCH", aenderung);
    if (!ergebnis) return false;
    await neuLaden();
    setMeldung({ art: "info", text: `Änderungen an ${z.name || z.email} gespeichert.` });
    return true;
  }

  async function schalte(z: Benutzerzeile) {
    const ergebnis = await ruf(z.id, `/api/benutzer/${z.id}`, "PATCH", { aktiv: !z.aktiv });
    if (!ergebnis) return;
    await neuLaden();
    setMeldung({
      art: "info",
      text: z.aktiv
        ? `${z.name || z.email} kann sich nicht mehr anmelden.`
        : `${z.name || z.email} ist wieder freigeschaltet.`,
    });
  }

  async function sendeLink(z: Benutzerzeile) {
    const ergebnis = await ruf(z.id, `/api/benutzer/${z.id}/passwort`, "POST");
    if (!ergebnis) return;
    setMeldung({
      art: "info",
      text: `Ein Link zum Festlegen eines neuen Passworts ist an ${z.email} unterwegs.`,
    });
  }

  async function loesche(z: Benutzerzeile) {
    const sicher = window.confirm(
      `Zugang von ${z.name || z.email} wirklich löschen? Das lässt sich nicht rückgängig machen. Soll die Person nur vorübergehend nicht mehr arbeiten, ist "Deaktivieren" der bessere Weg.`,
    );
    if (!sicher) return;
    const ergebnis = await ruf(z.id, `/api/benutzer/${z.id}`, "DELETE");
    if (!ergebnis) return;
    setListe((alt) => alt.filter((a) => a.id !== z.id));
    setMeldung({ art: "info", text: `Zugang von ${z.name || z.email} gelöscht.` });
  }

  return (
    <div className="space-y-6">
      {meldung && <Hinweisbox art={meldung.art}>{meldung.text}</Hinweisbox>}

      <div className="flex justify-end">
        <Knopf type="button" onClick={() => setNeuOffen((o) => !o)} art={neuOffen ? "neben" : "haupt"}>
          {neuOffen ? "Abbrechen" : "Neuen Zugang anlegen"}
        </Knopf>
      </div>

      {neuOffen && (
        <NeuerZugang
          onFertig={async (text) => {
            setNeuOffen(false);
            await neuLaden();
            setMeldung({ art: "info", text });
          }}
          onFehler={(text) => setMeldung({ art: "warnung", text })}
        />
      )}

      <div className="space-y-3">
        {liste.map((z) => (
          <Zeile
            key={z.id}
            zeile={z}
            selbst={z.id === eigeneId}
            beschaeftigt={laeuft === z.id}
            onSpeichern={speichere}
            onSchalten={schalte}
            onLink={sendeLink}
            onLoeschen={loesche}
          />
        ))}
        {liste.length === 0 && (
          <Karte>
            <p className="text-sm text-tinte-500">Es sind noch keine Zugänge angelegt.</p>
          </Karte>
        )}
      </div>
    </div>
  );
}

function Zeile({
  zeile,
  selbst,
  beschaeftigt,
  onSpeichern,
  onSchalten,
  onLink,
  onLoeschen,
}: {
  zeile: Benutzerzeile;
  selbst: boolean;
  beschaeftigt: boolean;
  onSpeichern: (z: Benutzerzeile, a: { name?: string; rolle?: Rolle }) => Promise<boolean>;
  onSchalten: (z: Benutzerzeile) => void;
  onLink: (z: Benutzerzeile) => void;
  onLoeschen: (z: Benutzerzeile) => void;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [name, setName] = useState(zeile.name);
  const [rolle, setRolle] = useState<Rolle>(zeile.rolle);

  function abbrechen() {
    setName(zeile.name);
    setRolle(zeile.rolle);
    setBearbeiten(false);
  }

  async function speichern() {
    const erfolg = await onSpeichern(zeile, { name: name.trim(), rolle });
    if (erfolg) setBearbeiten(false);
  }

  return (
    <Karte className={zeile.aktiv ? "" : "opacity-70"}>
      {/* Am Telefon untereinander: nebeneinander passen die Knöpfe nicht in die
          Karte und schieben die ganze Seite in die Breite. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          {bearbeiten ? (
            <div className="grid max-w-xl gap-4 sm:grid-cols-2">
              <Textfeld
                etikett="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Auswahlfeld
                etikett="Rolle"
                value={rolle}
                hinweis={ROLLEN.find((r) => r.wert === rolle)?.beschreibung}
                onChange={(e) => setRolle(e.target.value as Rolle)}
                optionen={ROLLEN.map((r) => ({ wert: r.wert, text: r.text }))}
                disabled={selbst}
              />
              {selbst && (
                <p className="hinweis sm:col-span-2">
                  Die eigene Rolle lässt sich nicht ändern.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-tinte-900">{zeile.name || "Ohne Namen"}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${ROLLENFARBE[zeile.rolle]}`}
                >
                  {rollenName(zeile.rolle)}
                </span>
                {selbst && (
                  <span className="rounded-full border border-tinte-200 bg-white px-2 py-0.5 text-xs text-tinte-500">
                    Sie
                  </span>
                )}
                {!zeile.aktiv && (
                  <span className="rounded-full border border-tinte-300 bg-tinte-100 px-2 py-0.5 text-xs font-medium text-tinte-600">
                    Deaktiviert
                  </span>
                )}
                {zeile.aktiv && !zeile.letzteAnmeldung && (
                  <span className="rounded-full border border-brk-200 bg-brk-50 px-2 py-0.5 text-xs font-medium text-brk-800">
                    Noch nie angemeldet
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-tinte-600">{zeile.email}</p>
              <p className="mt-1 text-xs text-tinte-500">
                Angelegt am {datum(zeile.erstelltAm)} · Letzte Anmeldung{" "}
                {datum(zeile.letzteAnmeldung)}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:shrink-0">
          {bearbeiten ? (
            <>
              <Knopf type="button" onClick={speichern} disabled={beschaeftigt} className="px-3 py-1.5 text-sm">
                Speichern
              </Knopf>
              <Knopf type="button" art="neben" onClick={abbrechen} className="px-3 py-1.5 text-sm">
                Abbrechen
              </Knopf>
            </>
          ) : (
            <>
              <Knopf
                type="button"
                art="neben"
                onClick={() => setBearbeiten(true)}
                className="px-3 py-1.5 text-sm"
              >
                Bearbeiten
              </Knopf>
              <Knopf
                type="button"
                art="neben"
                onClick={() => onLink(zeile)}
                disabled={beschaeftigt || !zeile.aktiv}
                className="px-3 py-1.5 text-sm"
              >
                Passwort-Link senden
              </Knopf>
              <Knopf
                type="button"
                art="neben"
                onClick={() => onSchalten(zeile)}
                disabled={beschaeftigt || selbst}
                className="px-3 py-1.5 text-sm"
              >
                {zeile.aktiv ? "Deaktivieren" : "Aktivieren"}
              </Knopf>
              <Knopf
                type="button"
                art="still"
                onClick={() => onLoeschen(zeile)}
                disabled={beschaeftigt || selbst}
                className="px-3 py-1.5 text-sm text-brk-700 hover:bg-brk-50"
              >
                Löschen
              </Knopf>
            </>
          )}
        </div>
      </div>
    </Karte>
  );
}

function NeuerZugang({
  onFertig,
  onFehler,
}: {
  onFertig: (meldung: string) => void | Promise<void>;
  onFehler: (meldung: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [rolle, setRolle] = useState<Rolle>("mitarbeiter");
  const [einladen, setEinladen] = useState(true);
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState(false);

  async function anlegen() {
    setLaeuft(true);
    setFehler({});
    try {
      const antwort = await fetch("/api/benutzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, rolle, einladen, passwort }),
      });
      const ergebnis = await antwort.json().catch(() => ({}));
      if (!antwort.ok) {
        const text = (ergebnis.fehler as string) ?? "Der Zugang konnte nicht angelegt werden.";
        if (ergebnis.feld) setFehler({ [ergebnis.feld as string]: text });
        else onFehler(text);
        return;
      }
      await onFertig(
        (ergebnis.warnung as string) ??
          (einladen
            ? `Der Zugang für ${email} ist angelegt. Die Einladung mit dem Link zum Passwort ist unterwegs.`
            : `Der Zugang für ${email} ist angelegt. Bitte geben Sie das Passwort persönlich weiter.`),
      );
    } catch {
      onFehler("Keine Verbindung zum Server.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Karte>
      <h2 className="mb-4 text-base font-bold text-tinte-900">Neuen Zugang anlegen</h2>
      <div className="grid max-w-2xl gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Textfeld
            etikett="Name"
            pflicht
            autoComplete="off"
            value={name}
            fehler={fehler.name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textfeld
            etikett="E-Mail-Adresse"
            pflicht
            type="email"
            autoComplete="off"
            hinweis="Damit meldet sich die Person an."
            value={email}
            fehler={fehler.email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Auswahlfeld
          etikett="Rolle"
          pflicht
          value={rolle}
          hinweis={ROLLEN.find((r) => r.wert === rolle)?.beschreibung}
          onChange={(e) => setRolle(e.target.value as Rolle)}
          optionen={ROLLEN.map((r) => ({ wert: r.wert, text: r.text }))}
        />
        <Kontrollkaestchen
          etikett="Einladung per E-Mail schicken – die Person legt ihr Passwort selbst fest"
          hinweis="Empfohlen. Der Link gilt sieben Tage. Ohne Einladung vergeben Sie hier ein Startpasswort und geben es persönlich weiter."
          checked={einladen}
          onChange={(e) => setEinladen(e.target.checked)}
        />
        {!einladen && (
          <Textfeld
            etikett="Startpasswort"
            pflicht
            type="text"
            autoComplete="off"
            hinweis="Mindestens 10 Zeichen. Bitte nicht per E-Mail versenden."
            value={passwort}
            fehler={fehler.passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
        )}
        <div className="flex justify-end">
          <Knopf type="button" onClick={anlegen} disabled={laeuft}>
            {laeuft ? "Wird angelegt …" : "Zugang anlegen"}
          </Knopf>
        </div>
      </div>
    </Karte>
  );
}
