"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BEZUGSARTEN, Bestellung, Kontaktperson, Pflegegrad } from "@/lib/typen";

import {
  Auswahlfeld,
  Datumsfeld,
  Kontrollkaestchen,
  Textbereich,
  Textfeld,
} from "./formular";
import { Hinweisbox, Karte, Knopf } from "./ui";

const ANREDEN = [
  { wert: "Frau", text: "Frau" },
  { wert: "Herr", text: "Herr" },
  { wert: "Divers", text: "Divers" },
];

const PFLEGEGRADE = [
  { wert: "ohne", text: "kein Pflegegrad" },
  { wert: "1", text: "Pflegegrad 1" },
  { wert: "2", text: "Pflegegrad 2" },
  { wert: "3", text: "Pflegegrad 3" },
  { wert: "4", text: "Pflegegrad 4" },
  { wert: "5", text: "Pflegegrad 5" },
];

const LEERE_PERSON: Kontaktperson = {
  name: "",
  bezugsart: "Sohn/Tochter",
  telefon: "",
  anschrift: "",
  schluesselVorhanden: false,
};

/**
 * Nachbearbeitung eines abgeschlossenen Vertrags.
 *
 * Paket, Zusatzleistungen und Beitrag fehlen hier bewusst: der Kunde hat einen
 * bestimmten Leistungsumfang zu einem bestimmten Preis unterschrieben. Eine
 * Änderung daran wäre ein neuer Vertrag und keine Korrektur.
 */
export function Vertragsformular({
  id,
  vorgangsnummer,
  vertragsnummer,
  bestellung,
  notiz,
  hatEmail,
}: {
  id: string;
  vorgangsnummer: string;
  vertragsnummer: string;
  bestellung: Bestellung;
  notiz: string;
  hatEmail: boolean;
}) {
  const router = useRouter();
  const [nummer, setNummer] = useState(vertragsnummer);
  const [b, setB] = useState<Bestellung>(bestellung);
  const [bemerkung, setBemerkung] = useState(notiz);
  const [benachrichtigen, setBenachrichtigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "info" | "warnung"; text: string } | null>(
    null,
  );

  const personen = b.kontaktpersonen.length ? b.kontaktpersonen : [LEERE_PERSON];
  const setzeT = (feld: keyof Bestellung["teilnehmer"], wert: string) =>
    setB((alt) => ({ ...alt, teilnehmer: { ...alt.teilnehmer, [feld]: wert } }));
  const setzeK = (index: number, feld: keyof Kontaktperson, wert: string | boolean) =>
    setB((alt) => ({
      ...alt,
      kontaktpersonen: personen.map((p, i) => (i === index ? { ...p, [feld]: wert } : p)),
    }));

  async function speichern() {
    setLaeuft(true);
    setMeldung(null);
    try {
      const antwort = await fetch(`/api/vertrag/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertragsnummer: nummer,
          teilnehmer: b.teilnehmer,
          pflegegrad: b.pflegegrad,
          pflegekasseName: b.pflegekasseName,
          pflegekasseAnschrift: b.pflegekasseAnschrift,
          versichertennummer: b.versichertennummer,
          telefonanbieter: b.telefonanbieter,
          geraeteRufnummer: b.geraeteRufnummer,
          keySafeStandortWunsch: b.keySafeStandortWunsch,
          zugangshinweise: b.zugangshinweise,
          hausarztName: b.hausarztName,
          hausarztTelefon: b.hausarztTelefon,
          notfallhinweise: b.notfallhinweise,
          kontaktpersonen: personen,
          sepaKontoinhaber: b.sepaKontoinhaber,
          sepaAnschrift: b.sepaAnschrift,
          sepaIban: b.sepaIban,
          sepaBic: b.sepaBic,
          sepaBank: b.sepaBank,
          notiz: bemerkung,
          kundeBenachrichtigen: benachrichtigen,
        }),
      });
      const ergebnis = await antwort.json();
      if (!antwort.ok) {
        setMeldung({ art: "warnung", text: ergebnis.fehler ?? "Speichern fehlgeschlagen" });
        return;
      }
      if (ergebnis.geaendert?.length === 0) {
        setMeldung({ art: "info", text: "Es wurde nichts geändert." });
        return;
      }
      setMeldung({
        art: "info",
        text:
          ergebnis.hinweis ??
          `Gespeichert und Vertrag neu erzeugt. Geändert: ${ergebnis.geaendert.join(", ")}.`,
      });
      router.refresh();
    } catch {
      setMeldung({ art: "warnung", text: "Verbindung fehlgeschlagen." });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {meldung && <Hinweisbox art={meldung.art}>{meldung.text}</Hinweisbox>}

      <Hinweisbox>
        Beim Speichern wird das Vertrags-PDF mit den geänderten Angaben neu
        erzeugt. Die vom Kunden unterschriebene Erstfassung bleibt daneben
        unverändert erhalten und ist weiterhin abrufbar.
      </Hinweisbox>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Vertragsnummer</h2>
        <div className="max-w-xs">
          <Textfeld
            etikett="Vertragsnummer des Kreisverbands"
            hinweis={`Erscheint auf allen 27 Seiten. Interne Vorgangsnummer: ${vorgangsnummer}`}
            placeholder="z. B. 2026/0417"
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Teilnehmer</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Auswahlfeld
              etikett="Anrede"
              optionen={ANREDEN}
              value={b.teilnehmer.anrede}
              onChange={(e) => setzeT("anrede", e.target.value)}
            />
            <Textfeld
              etikett="Vorname"
              value={b.teilnehmer.vorname}
              onChange={(e) => setzeT("vorname", e.target.value)}
            />
            <Textfeld
              etikett="Nachname"
              value={b.teilnehmer.nachname}
              onChange={(e) => setzeT("nachname", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Datumsfeld
              etikett="Geburtsdatum"
              ab="1900-01-01"
              hoechstensHeute
              wert={b.teilnehmer.geburtsdatum}
              onAendern={(wert) => setzeT("geburtsdatum", wert)}
            />
            <Textfeld
              etikett="Telefon"
              value={b.teilnehmer.telefon}
              onChange={(e) => setzeT("telefon", e.target.value)}
            />
          </div>
          <Textfeld
            etikett="Straße und Hausnummer"
            value={b.teilnehmer.strasse}
            onChange={(e) => setzeT("strasse", e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Textfeld
              etikett="Postleitzahl"
              inputMode="numeric"
              maxLength={5}
              value={b.teilnehmer.plz}
              onChange={(e) => setzeT("plz", e.target.value.replace(/\D/g, ""))}
            />
            <Textfeld
              etikett="Ort"
              value={b.teilnehmer.ort}
              onChange={(e) => setzeT("ort", e.target.value)}
            />
          </div>
          <Textfeld
            etikett="E-Mail-Adresse"
            type="email"
            hinweis="An diese Adresse gehen die Vertragsunterlagen."
            value={b.teilnehmer.email}
            onChange={(e) => setzeT("email", e.target.value)}
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Pflegekasse</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Auswahlfeld
              etikett="Pflegegrad"
              optionen={PFLEGEGRADE}
              value={b.pflegegrad}
              onChange={(e) =>
                setB({ ...b, pflegegrad: e.target.value as Pflegegrad })
              }
            />
            <Textfeld
              etikett="Versichertennummer"
              value={b.versichertennummer}
              onChange={(e) => setB({ ...b, versichertennummer: e.target.value })}
            />
          </div>
          <Textfeld
            etikett="Pflegekasse"
            value={b.pflegekasseName}
            onChange={(e) => setB({ ...b, pflegekasseName: e.target.value })}
          />
          <Textfeld
            etikett="Anschrift der Pflegekasse"
            value={b.pflegekasseAnschrift}
            onChange={(e) => setB({ ...b, pflegekasseAnschrift: e.target.value })}
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Kontaktpersonen</h2>
        <div className="space-y-4">
          {personen.map((p, i) => (
            <div key={i} className="rounded-lg border border-tinte-200 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Textfeld
                  etikett={`${i + 1}. Name`}
                  value={p.name}
                  onChange={(e) => setzeK(i, "name", e.target.value)}
                />
                <Auswahlfeld
                  etikett="Beziehung"
                  optionen={BEZUGSARTEN.map((x) => ({ wert: x, text: x }))}
                  value={p.bezugsart}
                  onChange={(e) => setzeK(i, "bezugsart", e.target.value)}
                />
                <Textfeld
                  etikett="Telefon"
                  value={p.telefon}
                  onChange={(e) => setzeK(i, "telefon", e.target.value)}
                />
                <Textfeld
                  etikett="Anschrift"
                  value={p.anschrift}
                  onChange={(e) => setzeK(i, "anschrift", e.target.value)}
                />
              </div>
              <div className="mt-3">
                <Kontrollkaestchen
                  etikett="Hat einen Wohnungsschlüssel"
                  checked={p.schluesselVorhanden}
                  onChange={(e) => setzeK(i, "schluesselVorhanden", e.target.checked)}
                />
              </div>
            </div>
          ))}
          {personen.length < 4 && (
            <Knopf
              art="neben"
              type="button"
              onClick={() =>
                setB({ ...b, kontaktpersonen: [...personen, { ...LEERE_PERSON }] })
              }
            >
              Weitere Kontaktperson
            </Knopf>
          )}
          <p className="text-xs text-tinte-500">
            Zeilen ohne Namen werden beim Speichern entfernt.
          </p>
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">
          Anschluss, Zugang und Notfallangaben
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Telefonanbieter"
              value={b.telefonanbieter}
              onChange={(e) => setB({ ...b, telefonanbieter: e.target.value })}
            />
            <Textfeld
              etikett="Telefonnummer des Geräts"
              value={b.geraeteRufnummer}
              onChange={(e) => setB({ ...b, geraeteRufnummer: e.target.value })}
            />
          </div>
          <Textfeld
            etikett="Schlüsseltresor"
            value={b.keySafeStandortWunsch}
            onChange={(e) => setB({ ...b, keySafeStandortWunsch: e.target.value })}
          />
          <Textbereich
            etikett="Zugangshinweise"
            rows={2}
            value={b.zugangshinweise}
            onChange={(e) => setB({ ...b, zugangshinweise: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Hausarzt"
              value={b.hausarztName}
              onChange={(e) => setB({ ...b, hausarztName: e.target.value })}
            />
            <Textfeld
              etikett="Telefon der Praxis"
              value={b.hausarztTelefon}
              onChange={(e) => setB({ ...b, hausarztTelefon: e.target.value })}
            />
          </div>
          <Textbereich
            etikett="Hinweise für die Notrufzentrale"
            rows={2}
            value={b.notfallhinweise}
            onChange={(e) => setB({ ...b, notfallhinweise: e.target.value })}
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Bankverbindung</h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Kontoinhaber"
              value={b.sepaKontoinhaber}
              onChange={(e) => setB({ ...b, sepaKontoinhaber: e.target.value })}
            />
            <Textfeld
              etikett="Anschrift des Kontoinhabers"
              value={b.sepaAnschrift}
              onChange={(e) => setB({ ...b, sepaAnschrift: e.target.value })}
            />
          </div>
          <Textfeld
            etikett="IBAN"
            spellCheck={false}
            value={b.sepaIban}
            onChange={(e) => setB({ ...b, sepaIban: e.target.value.toUpperCase() })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="BIC"
              value={b.sepaBic}
              onChange={(e) => setB({ ...b, sepaBic: e.target.value.toUpperCase() })}
            />
            <Textfeld
              etikett="Kreditinstitut"
              value={b.sepaBank}
              onChange={(e) => setB({ ...b, sepaBank: e.target.value })}
            />
          </div>
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Interne Notiz</h2>
        <Textbereich
          etikett="Notiz"
          hinweis="Nur für das Backoffice. Erscheint nicht im Vertrag."
          rows={3}
          value={bemerkung}
          onChange={(e) => setBemerkung(e.target.value)}
        />
      </Karte>

      <Karte>
        <Kontrollkaestchen
          etikett="Kunden über die geänderte Fassung informieren"
          hinweis={
            hatEmail
              ? "Der Kunde erhält den neu erzeugten Vertrag per E-Mail, mit Angabe der geänderten Felder."
              : "Für diesen Vertrag ist keine E-Mail-Adresse hinterlegt – es kann nichts verschickt werden."
          }
          checked={benachrichtigen}
          disabled={!hatEmail}
          onChange={(e) => setBenachrichtigen(e.target.checked)}
        />
      </Karte>

      <div className="flex justify-end gap-3">
        <Knopf art="neben" type="button" onClick={() => router.back()}>
          Abbrechen
        </Knopf>
        <Knopf type="button" onClick={speichern} disabled={laeuft}>
          {laeuft ? "Wird gespeichert …" : "Speichern und Vertrag neu erzeugen"}
        </Knopf>
      </div>
    </div>
  );
}
