"use client";

import { ReactNode, useCallback, useEffect } from "react";

import {
  OptionId,
  PAKETE,
  PaketId,
  optionenFuerPaket,
  paketById,
} from "@/lib/katalog";
import { berechnePreis, euro } from "@/lib/preis";
import { BEZUGSARTEN, Bestellung, Kontaktperson, Pflegegrad } from "@/lib/typen";

import {
  Auswahlfeld,
  Kontrollkaestchen,
  Textbereich,
  Textfeld,
  Wahlgruppe,
} from "./formular";
import { Hinweisbox, Knopf } from "./ui";

export type Entwurf = Partial<Bestellung>;
export type Fehler = Record<string, string>;

export interface SchrittProps {
  daten: Entwurf;
  setze: (aenderung: Partial<Bestellung>) => void;
  fehler: Fehler;
}

const ANREDEN = [
  { wert: "Frau", text: "Frau" },
  { wert: "Herr", text: "Herr" },
  { wert: "Divers", text: "Divers" },
];

function Gitter({ children, spalten = 2 }: { children: ReactNode; spalten?: 2 | 3 }) {
  return (
    <div
      className={`grid gap-4 ${spalten === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------- 1. Kostenträger

export function SchrittKostentraeger({ daten, setze, fehler }: SchrittProps) {
  const hatPflegegrad = daten.pflegegrad !== "ohne" && daten.pflegegrad !== undefined;

  return (
    <div className="space-y-6">
      <Wahlgruppe
        etikett="Wer schließt den Vertrag ab?"
        wert={
          daten.bestellerIstTeilnehmer === undefined
            ? null
            : daten.bestellerIstTeilnehmer
              ? "selbst"
              : "angehoerig"
        }
        onAendern={(wert) =>
          setze({
            bestellerIstTeilnehmer: wert === "selbst",
            besteller:
              wert === "selbst"
                ? undefined
                : (daten.besteller ?? {
                    anrede: "Frau",
                    vorname: "",
                    nachname: "",
                    telefon: "",
                    email: "",
                    bevollmaechtigt: false,
                  }),
          })
        }
        optionen={[
          {
            wert: "angehoerig",
            text: "Ich bestelle für eine andere Person",
            beschreibung: "Zum Beispiel für einen Elternteil. Sie unterschreiben den Vertrag.",
          },
          {
            wert: "selbst",
            text: "Ich bestelle für mich selbst",
            beschreibung: "Sie sind der künftige Teilnehmer des Hausnotrufs.",
          },
        ]}
        fehler={fehler["bestellerIstTeilnehmer"]}
      />

      {daten.bestellerIstTeilnehmer === false && (
        <div className="rounded-lg border border-tinte-200 bg-tinte-50 p-4">
          <p className="mb-4 text-sm font-medium text-tinte-700">Ihre Kontaktdaten</p>
          <div className="space-y-4">
            <Gitter spalten={3}>
              <Auswahlfeld
                etikett="Anrede"
                pflicht
                optionen={ANREDEN}
                value={daten.besteller?.anrede ?? "Frau"}
                onChange={(e) =>
                  setze({
                    besteller: {
                      ...daten.besteller!,
                      anrede: e.target.value as "Frau" | "Herr" | "Divers",
                    },
                  })
                }
              />
              <Textfeld
                etikett="Vorname"
                pflicht
                autoComplete="given-name"
                value={daten.besteller?.vorname ?? ""}
                fehler={fehler["besteller.vorname"]}
                onChange={(e) =>
                  setze({ besteller: { ...daten.besteller!, vorname: e.target.value } })
                }
              />
              <Textfeld
                etikett="Nachname"
                pflicht
                autoComplete="family-name"
                value={daten.besteller?.nachname ?? ""}
                fehler={fehler["besteller.nachname"]}
                onChange={(e) =>
                  setze({ besteller: { ...daten.besteller!, nachname: e.target.value } })
                }
              />
            </Gitter>
            <Gitter>
              <Textfeld
                etikett="Telefon"
                pflicht
                type="tel"
                autoComplete="tel"
                value={daten.besteller?.telefon ?? ""}
                fehler={fehler["besteller.telefon"]}
                onChange={(e) =>
                  setze({ besteller: { ...daten.besteller!, telefon: e.target.value } })
                }
              />
              <Textfeld
                etikett="E-Mail-Adresse"
                pflicht
                type="email"
                autoComplete="email"
                hinweis="An diese Adresse schicken wir den Vertrag."
                value={daten.besteller?.email ?? ""}
                fehler={fehler["besteller.email"]}
                onChange={(e) =>
                  setze({ besteller: { ...daten.besteller!, email: e.target.value } })
                }
              />
            </Gitter>
            <Kontrollkaestchen
              etikett="Ich bin bevollmächtigt, für diese Person zu handeln und den Vertrag in ihrem Namen abzuschließen."
              checked={daten.besteller?.bevollmaechtigt ?? false}
              fehler={fehler["besteller.bevollmaechtigt"]}
              onChange={(e) =>
                setze({
                  besteller: { ...daten.besteller!, bevollmaechtigt: e.target.checked },
                })
              }
            />
          </div>
        </div>
      )}

      <Wahlgruppe<Pflegegrad>
        etikett="Liegt ein Pflegegrad vor?"
        hinweis="Mit einem Pflegegrad kann die Pflegekasse einen Teil der Kosten übernehmen."
        spalten={2}
        wert={daten.pflegegrad ?? null}
        onAendern={(wert) =>
          setze({
            pflegegrad: wert,
            kostenuebernahme: wert === "ohne" ? false : daten.kostenuebernahme,
          })
        }
        optionen={[
          { wert: "ohne", text: "Kein Pflegegrad" },
          { wert: "1", text: "Pflegegrad 1" },
          { wert: "2", text: "Pflegegrad 2" },
          { wert: "3", text: "Pflegegrad 3" },
          { wert: "4", text: "Pflegegrad 4" },
          { wert: "5", text: "Pflegegrad 5" },
        ]}
        fehler={fehler["pflegegrad"]}
      />

      {hatPflegegrad && (
        <div className="space-y-4 rounded-lg border border-tinte-200 bg-tinte-50 p-4">
          <Kontrollkaestchen
            etikett={
              <>
                <span className="font-medium">
                  Kostenübernahme bei der Pflegekasse beantragen
                </span>
                <span className="mt-0.5 block text-xs text-tinte-500">
                  Wir stellen den Antrag für Sie. Der ermäßigte Beitrag gilt ab
                  Bestätigung durch die Pflegekasse.
                </span>
              </>
            }
            checked={daten.kostenuebernahme ?? false}
            onChange={(e) => setze({ kostenuebernahme: e.target.checked })}
          />

          {daten.kostenuebernahme && (
            <div className="space-y-4 border-t border-tinte-200 pt-4">
              <Gitter>
                <Textfeld
                  etikett="Pflegekasse"
                  pflicht
                  placeholder="z. B. AOK Bayern – Pflegekasse"
                  value={daten.pflegekasseName ?? ""}
                  fehler={fehler["pflegekasseName"]}
                  onChange={(e) => setze({ pflegekasseName: e.target.value })}
                />
                <Textfeld
                  etikett="Versichertennummer"
                  pflicht
                  hinweis="Steht auf der Versichertenkarte."
                  value={daten.versichertennummer ?? ""}
                  fehler={fehler["versichertennummer"]}
                  onChange={(e) => setze({ versichertennummer: e.target.value })}
                />
              </Gitter>
              <Textfeld
                etikett="Anschrift der Pflegekasse"
                hinweis="Falls bekannt. Sonst ergänzen wir sie."
                value={daten.pflegekasseAnschrift ?? ""}
                onChange={(e) => setze({ pflegekasseAnschrift: e.target.value })}
              />
              <fieldset>
                <legend className="etikett">
                  Begründung für die Pflegekasse
                  <span className="ml-0.5 text-brk-600">*</span>
                </legend>
                <div className="space-y-2">
                  <Kontrollkaestchen
                    etikett="Die Person lebt allein oder ist über weite Teile des Tages allein."
                    checked={daten.grundAlleinlebend ?? false}
                    onChange={(e) => setze({ grundAlleinlebend: e.target.checked })}
                  />
                  <Kontrollkaestchen
                    etikett="Die Person kann mit einem gewöhnlichen Telefon keinen Hilferuf absetzen und es ist jederzeit mit einer Notsituation zu rechnen."
                    checked={daten.grundNotsituation ?? false}
                    onChange={(e) => setze({ grundNotsituation: e.target.checked })}
                  />
                </div>
                {fehler["grundAlleinlebend"] && (
                  <p className="fehlertext">{fehler["grundAlleinlebend"]}</p>
                )}
              </fieldset>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <Kontrollkaestchen
          etikett="Ich bin Mitglied im Sozialverband VdK (7 % Rabatt)"
          checked={daten.vdkMitglied ?? false}
          onChange={(e) => setze({ vdkMitglied: e.target.checked })}
        />
        {daten.vdkMitglied && (
          <Textfeld
            etikett="VdK-Mitgliedsnummer"
            pflicht
            value={daten.vdkMitgliedsnummer ?? ""}
            fehler={fehler["vdkMitgliedsnummer"]}
            onChange={(e) => setze({ vdkMitgliedsnummer: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------- 2. Paket

export function SchrittPaket({ daten, setze, fehler }: SchrittProps) {
  const hatPflegegrad = daten.pflegegrad !== "ohne";
  const kue = Boolean(daten.kostenuebernahme);

  const verfuegbar = PAKETE.filter((p) =>
    kue ? p.monatlichMitKue !== null : p.monatlichOhneKue !== null,
  );
  const paketId = (verfuegbar.find((p) => p.id === daten.paketId)?.id ??
    verfuegbar[0].id) as PaketId;
  const paket = paketById(paketId);
  const optionen = (daten.optionen ?? []) as OptionId[];
  const buchbar = optionenFuerPaket(paketId);
  const gueltig = optionen.filter((o) =>
    buchbar.some((b) => b.id === o && !b.immerEnthalten),
  );

  const preis = berechnePreis({
    paketId,
    optionen: gueltig,
    kostenuebernahme: kue,
    vdkMitglied: Boolean(daten.vdkMitglied),
  });

  return (
    <div className="space-y-6">
      {kue && (
        <Hinweisbox>
          Sie sehen die Beiträge mit Kostenübernahme. Bis die Pflegekasse zustimmt, gilt
          der reguläre Beitrag; wir informieren Sie über die Entscheidung.
        </Hinweisbox>
      )}
      {hatPflegegrad && !kue && (
        <Hinweisbox art="warnung">
          Sie haben angegeben, dass ein Pflegegrad vorliegt, aber keine Kostenübernahme
          beantragt. Mit Antrag wären mehrere Pakete deutlich günstiger.
        </Hinweisbox>
      )}

      <fieldset>
        <legend className="etikett">Paket auswählen</legend>
        <div className="space-y-2">
          {verfuegbar.map((p) => {
            const betrag = kue ? p.monatlichMitKue : p.monatlichOhneKue;
            const gewaehlt = p.id === paketId;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
                  gewaehlt
                    ? "border-brk-600 bg-brk-50 ring-1 ring-brk-600"
                    : "border-tinte-200 bg-white hover:border-tinte-300"
                }`}
              >
                <input
                  type="radio"
                  checked={gewaehlt}
                  onChange={() => setze({ paketId: p.id, optionen: [] })}
                  className="mt-1 h-4 w-4 shrink-0 accent-brk-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-tinte-900">{p.name}</span>
                    <span className="font-bold text-brk-700">
                      {euro(betrag ?? 0)} / Monat
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-tinte-600">
                    {p.beschreibung}
                  </span>
                  <span className="mt-1 block text-xs text-tinte-500">
                    {p.einsatzbereich}
                    {p.organisationspauschale > 0 &&
                      ` · einmalig ${euro(p.organisationspauschale)} Organisationspauschale`}
                    {p.kaufpreis !== null && ` · Gerätekauf ${euro(p.kaufpreis)}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {fehler["paketId"] && <p className="fehlertext">{fehler["paketId"]}</p>}
      </fieldset>

      {buchbar.length > 0 && (
        <fieldset>
          <legend className="etikett">Zusätzliche Leistungen</legend>
          <div className="space-y-2">
            {buchbar.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  o.immerEnthalten
                    ? "border-tinte-200 bg-tinte-50"
                    : "border-tinte-200 bg-white hover:border-tinte-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={o.immerEnthalten || optionen.includes(o.id)}
                  disabled={o.immerEnthalten}
                  onChange={() =>
                    setze({
                      optionen: optionen.includes(o.id)
                        ? optionen.filter((x) => x !== o.id)
                        : [...optionen, o.id],
                    })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brk-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-tinte-800">{o.name}</span>
                    <span className="shrink-0 text-sm text-tinte-600">
                      {o.immerEnthalten ? "enthalten" : `+ ${euro(o.monatlich)}`}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-tinte-500">{o.hinweis}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Preiszusammenfassung preis={preis} paketName={paket.name} />
    </div>
  );
}

export function Preiszusammenfassung({
  preis,
  paketName,
}: {
  preis: ReturnType<typeof berechnePreis>;
  paketName: string;
}) {
  return (
    <div className="rounded-lg border border-tinte-200 bg-white p-4">
      <p className="text-xs font-semibold tracking-wide text-tinte-500 uppercase">
        Ihr Beitrag – {paketName}
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-tinte-600">{preis.basis.bezeichnung}</dt>
          <dd className="font-medium">{euro(preis.basis.monatlich)} / Monat</dd>
        </div>
        {preis.zusatz.map((p) => (
          <div key={p.bezeichnung} className="flex justify-between gap-3">
            <dt className="text-tinte-600">{p.bezeichnung}</dt>
            <dd className="font-medium">
              {p.monatlich > 0
                ? `${euro(p.monatlich)} / Monat`
                : `${euro(p.einmalig)} einmalig`}
            </dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-3 border-t border-tinte-200 pt-2">
          <dt className="font-semibold text-tinte-900">Monatlich</dt>
          <dd className="font-bold text-tinte-900">{euro(preis.summe.monatlich)}</dd>
        </div>
        {preis.summe.einmalig > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-tinte-900">Einmalig</dt>
            <dd className="font-bold text-tinte-900">{euro(preis.summe.einmalig)}</dd>
          </div>
        )}
      </dl>
      {preis.vdkRabattBetrag > 0 && (
        <p className="mt-3 rounded-md bg-brk-50 px-3 py-2 text-xs text-brk-900">
          VdK-Rabatt berücksichtigt: {euro(preis.vdkRabattBetrag)} Ersparnis im ersten Jahr.
        </p>
      )}
      <p className="mt-3 text-xs text-tinte-500">
        {preis.inklusivEinsaetze > 0
          ? `${preis.inklusivEinsaetze} Helfereinsätze pro Jahr inklusive, jeder weitere ${euro(preis.einsatzpauschale)}.`
          : `Helfereinsätze werden mit ${euro(preis.einsatzpauschale)} je Einsatz berechnet.`}
      </p>
    </div>
  );
}

// ------------------------------------------------------- 3. Teilnehmer

export function SchrittTeilnehmer({ daten, setze, fehler }: SchrittProps) {
  const t = daten.teilnehmer;
  const aendere = (feld: string, wert: string) =>
    setze({ teilnehmer: { ...(t as NonNullable<typeof t>), [feld]: wert } });

  return (
    <div className="space-y-4">
      <p className="text-sm text-tinte-600">
        {daten.bestellerIstTeilnehmer
          ? "Bitte tragen Sie hier Ihre eigenen Daten ein."
          : "Bitte tragen Sie die Daten der Person ein, die den Hausnotruf nutzen wird."}
      </p>

      <Gitter spalten={3}>
        <Auswahlfeld
          etikett="Anrede"
          pflicht
          optionen={ANREDEN}
          value={t?.anrede ?? "Frau"}
          onChange={(e) => aendere("anrede", e.target.value)}
        />
        <Textfeld
          etikett="Vorname"
          pflicht
          value={t?.vorname ?? ""}
          fehler={fehler["teilnehmer.vorname"]}
          onChange={(e) => aendere("vorname", e.target.value)}
        />
        <Textfeld
          etikett="Nachname"
          pflicht
          value={t?.nachname ?? ""}
          fehler={fehler["teilnehmer.nachname"]}
          onChange={(e) => aendere("nachname", e.target.value)}
        />
      </Gitter>

      <Textfeld
        etikett="Geburtsdatum"
        pflicht
        placeholder="TT.MM.JJJJ"
        inputMode="numeric"
        value={t?.geburtsdatum ?? ""}
        fehler={fehler["teilnehmer.geburtsdatum"]}
        onChange={(e) => aendere("geburtsdatum", e.target.value)}
      />

      <Textfeld
        etikett="Straße und Hausnummer"
        pflicht
        autoComplete="street-address"
        hinweis="Anschrift, an der das Gerät installiert wird."
        value={t?.strasse ?? ""}
        fehler={fehler["teilnehmer.strasse"]}
        onChange={(e) => aendere("strasse", e.target.value)}
      />

      <Gitter>
        <Textfeld
          etikett="Postleitzahl"
          pflicht
          inputMode="numeric"
          maxLength={5}
          value={t?.plz ?? ""}
          fehler={fehler["teilnehmer.plz"]}
          onChange={(e) => aendere("plz", e.target.value.replace(/\D/g, ""))}
        />
        <Textfeld
          etikett="Ort"
          pflicht
          value={t?.ort ?? ""}
          fehler={fehler["teilnehmer.ort"]}
          onChange={(e) => aendere("ort", e.target.value)}
        />
      </Gitter>

      <Gitter>
        <Textfeld
          etikett="Telefon"
          pflicht
          type="tel"
          hinweis="Festnetz der Wohnung, falls vorhanden."
          value={t?.telefon ?? ""}
          fehler={fehler["teilnehmer.telefon"]}
          onChange={(e) => aendere("telefon", e.target.value)}
        />
        <Textfeld
          etikett="E-Mail-Adresse"
          pflicht={Boolean(daten.bestellerIstTeilnehmer)}
          type="email"
          hinweis={
            daten.bestellerIstTeilnehmer
              ? "An diese Adresse schicken wir den Vertrag."
              : "Optional – nur falls die Person selbst E-Mails nutzt."
          }
          value={t?.email ?? ""}
          fehler={fehler["teilnehmer.email"]}
          onChange={(e) => aendere("email", e.target.value)}
        />
      </Gitter>
    </div>
  );
}

// ------------------------------------------------------- 4. Anschluss

export function SchrittAnschluss({ daten, setze, fehler }: SchrittProps) {
  return (
    <div className="space-y-6">
      <Hinweisbox>
        Das Hausnotrufgerät braucht einen Anschluss, um die Notrufzentrale zu erreichen.
        Wenn Sie unsicher sind, wählen Sie einfach „Weiß ich nicht“ — unser Techniker
        klärt das beim Termin vor Ort.
      </Hinweisbox>

      <Wahlgruppe
        etikett="Welchen Telefonanschluss gibt es in der Wohnung?"
        wert={daten.anschlussart ?? null}
        onAendern={(wert) => setze({ anschlussart: wert })}
        optionen={[
          {
            wert: "voip",
            text: "Internetanschluss mit Telefon (VoIP)",
            beschreibung: "Der übliche Fall: Telefon läuft über einen Router, z. B. eine Fritz!Box.",
          },
          {
            wert: "msan",
            text: "Klassischer Telefonanschluss",
            beschreibung: "Nachfolger des analogen Anschlusses (MSAN-POTS).",
          },
          {
            wert: "gsm",
            text: "Kein Festnetz – Mobilfunk (GSM)",
            beschreibung: "Das Gerät wird über eine SIM-Karte angebunden, die wir stellen.",
          },
          {
            wert: "unbekannt",
            text: "Weiß ich nicht",
            beschreibung: "Kein Problem – unser Techniker prüft das beim Termin vor Ort.",
          },
        ]}
        fehler={fehler["anschlussart"]}
      />

      <Gitter>
        <Textfeld
          etikett="Telefonanbieter"
          hinweis="Zum Beispiel Telekom, Vodafone, 1&1."
          value={daten.telefonanbieter ?? ""}
          onChange={(e) => setze({ telefonanbieter: e.target.value })}
        />
        <Textfeld
          etikett="Telefonnummer des Anschlusses"
          hinweis="Falls abweichend von der oben genannten Nummer."
          type="tel"
          value={daten.geraeteRufnummer ?? ""}
          onChange={(e) => setze({ geraeteRufnummer: e.target.value })}
        />
      </Gitter>
    </div>
  );
}

// ------------------------------------------------------- 5. Kontaktpersonen

const LEERE_KONTAKTPERSON: Kontaktperson = {
  name: "",
  bezugsart: "Sohn/Tochter",
  telefon: "",
  anschrift: "",
  schluesselVorhanden: false,
};

export function SchrittKontaktpersonen({ daten, setze, fehler }: SchrittProps) {
  const personen = daten.kontaktpersonen?.length
    ? daten.kontaktpersonen
    : [LEERE_KONTAKTPERSON];

  const aendere = (index: number, feld: keyof Kontaktperson, wert: string | boolean) => {
    const kopie = personen.map((p, i) => (i === index ? { ...p, [feld]: wert } : p));
    setze({ kontaktpersonen: kopie });
  };

  return (
    <div className="space-y-5">
      <Hinweisbox>
        Wenn ein Notruf eingeht, verständigt unsere Zentrale diese Personen. Bitte klären
        Sie vorab mit ihnen ab, dass wir sie im Notfall anrufen dürfen. Es sind bis zu
        vier Personen vorgesehen.
      </Hinweisbox>

      {personen.map((person, index) => (
        <div key={index} className="rounded-lg border border-tinte-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-tinte-700">
              {index + 1}. Kontaktperson
              {index === 0 && <span className="ml-1 text-brk-600">*</span>}
            </p>
            {personen.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setze({ kontaktpersonen: personen.filter((_, i) => i !== index) })
                }
                className="text-xs font-medium text-tinte-500 underline underline-offset-2 hover:text-brk-700"
              >
                Entfernen
              </button>
            )}
          </div>
          <div className="space-y-4">
            <Gitter>
              <Textfeld
                etikett="Name"
                pflicht={index === 0}
                value={person.name}
                fehler={fehler[`kontaktpersonen.${index}.name`]}
                onChange={(e) => aendere(index, "name", e.target.value)}
              />
              <Auswahlfeld
                etikett="Beziehung zur Person"
                optionen={BEZUGSARTEN.map((b) => ({ wert: b, text: b }))}
                value={person.bezugsart}
                onChange={(e) => aendere(index, "bezugsart", e.target.value)}
              />
            </Gitter>
            <Gitter>
              <Textfeld
                etikett="Telefon"
                pflicht={index === 0}
                type="tel"
                value={person.telefon}
                fehler={fehler[`kontaktpersonen.${index}.telefon`]}
                onChange={(e) => aendere(index, "telefon", e.target.value)}
              />
              <Textfeld
                etikett="Anschrift"
                hinweis="Hilft im Notfall bei der Einsatzplanung."
                value={person.anschrift}
                onChange={(e) => aendere(index, "anschrift", e.target.value)}
              />
            </Gitter>
            <Kontrollkaestchen
              etikett="Diese Person hat einen Wohnungsschlüssel."
              checked={person.schluesselVorhanden}
              onChange={(e) => aendere(index, "schluesselVorhanden", e.target.checked)}
            />
          </div>
        </div>
      ))}

      {personen.length < 4 && (
        <Knopf
          art="neben"
          type="button"
          onClick={() => setze({ kontaktpersonen: [...personen, LEERE_KONTAKTPERSON] })}
        >
          Weitere Kontaktperson hinzufügen
        </Knopf>
      )}
      {fehler["kontaktpersonen"] && <p className="fehlertext">{fehler["kontaktpersonen"]}</p>}
    </div>
  );
}

// ------------------------------------------------------- 6. Zugang

export function SchrittZugang({ daten, setze }: SchrittProps) {
  return (
    <div className="space-y-5">
      <Hinweisbox>
        Damit im Notfall schnell jemand in die Wohnung kommt, bringen wir einen
        Schlüsseltresor an der Wohnung an. Der Schlüssel bleibt bei Ihnen vor Ort — wir
        bewahren keine Schlüssel im Kreisverband auf.
      </Hinweisbox>

      <Textfeld
        etikett="Wo soll der Schlüsseltresor angebracht werden?"
        hinweis="Zum Beispiel „rechts neben der Haustür“. Der Techniker stimmt es vor Ort mit Ihnen ab."
        value={daten.keySafeStandortWunsch ?? ""}
        onChange={(e) => setze({ keySafeStandortWunsch: e.target.value })}
      />

      <Textbereich
        etikett="Hinweise zum Zugang"
        hinweis="Stockwerk, Klingelschild, Hund im Haus, schwer zu findender Eingang …"
        value={daten.zugangshinweise ?? ""}
        onChange={(e) => setze({ zugangshinweise: e.target.value })}
      />

      <div className="border-t border-tinte-200 pt-5">
        <p className="mb-4 text-sm font-medium text-tinte-700">
          Angaben für den Notfall
        </p>
        <div className="space-y-4">
          <Gitter>
            <Textfeld
              etikett="Hausärztin oder Hausarzt"
              value={daten.hausarztName ?? ""}
              onChange={(e) => setze({ hausarztName: e.target.value })}
            />
            <Textfeld
              etikett="Telefon der Praxis"
              type="tel"
              value={daten.hausarztTelefon ?? ""}
              onChange={(e) => setze({ hausarztTelefon: e.target.value })}
            />
          </Gitter>
          <Textbereich
            etikett="Weitere Hinweise für die Notrufzentrale"
            hinweis="Zum Beispiel Schwerhörigkeit, Sprachschwierigkeiten oder wichtige Besonderheiten. Ausführliche Gesundheitsangaben nimmt unser Techniker beim Termin vor Ort auf."
            value={daten.notfallhinweise ?? ""}
            onChange={(e) => setze({ notfallhinweise: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------- 7. Zahlung

export function SchrittZahlung({ daten, setze, fehler }: SchrittProps) {
  const teilnehmerZahlt = daten.zahlungspflichtigerIstTeilnehmer ?? true;
  const t = daten.teilnehmer;

  const uebernehmeTeilnehmer = useCallback(() => {
    if (!t) return;
    setze({
      zahlungspflichtigerIstTeilnehmer: true,
      sepaKontoinhaber: `${t.vorname} ${t.nachname}`.trim(),
      sepaAnschrift: `${t.strasse}, ${t.plz} ${t.ort}`,
    });
  }, [t, setze]);

  // "Konto des Teilnehmers" ist vorausgewählt. Ohne diese Vorbelegung blieben
  // die Felder trotzdem leer, und der Kunde müsste die bereits markierte
  // Option erst anklicken, damit etwas passiert.
  useEffect(() => {
    if (teilnehmerZahlt && !daten.sepaKontoinhaber && t?.nachname) {
      uebernehmeTeilnehmer();
    }
    // Nur beim Betreten des Schritts – spätere Änderungen sollen die
    // Eingaben des Kunden nicht überschreiben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <Hinweisbox>
        Die Beiträge werden per SEPA-Lastschrift eingezogen. Monatliche Beträge sind
        jeweils zum Ersten des Monats fällig.
      </Hinweisbox>

      <Wahlgruppe
        etikett="Von welchem Konto sollen wir abbuchen?"
        wert={teilnehmerZahlt ? "teilnehmer" : "andere"}
        onAendern={(wert) => {
          if (wert === "teilnehmer") uebernehmeTeilnehmer();
          else setze({ zahlungspflichtigerIstTeilnehmer: false });
        }}
        optionen={[
          {
            wert: "teilnehmer",
            text: t ? `Konto von ${t.vorname} ${t.nachname}` : "Konto des Teilnehmers",
          },
          { wert: "andere", text: "Ein anderes Konto" },
        ]}
      />

      <Gitter>
        <Textfeld
          etikett="Kontoinhaber"
          pflicht
          autoComplete="name"
          value={daten.sepaKontoinhaber ?? ""}
          fehler={fehler["sepaKontoinhaber"]}
          onChange={(e) => setze({ sepaKontoinhaber: e.target.value })}
        />
        <Textfeld
          etikett="Anschrift des Kontoinhabers"
          pflicht
          value={daten.sepaAnschrift ?? ""}
          fehler={fehler["sepaAnschrift"]}
          onChange={(e) => setze({ sepaAnschrift: e.target.value })}
        />
      </Gitter>

      <Textfeld
        etikett="IBAN"
        pflicht
        placeholder="DE00 0000 0000 0000 0000 00"
        autoComplete="off"
        spellCheck={false}
        value={daten.sepaIban ?? ""}
        fehler={fehler["sepaIban"]}
        onChange={(e) => setze({ sepaIban: e.target.value.toUpperCase() })}
      />

      <Gitter>
        <Textfeld
          etikett="BIC"
          hinweis="Optional — bei deutschen Konten nicht nötig."
          value={daten.sepaBic ?? ""}
          onChange={(e) => setze({ sepaBic: e.target.value.toUpperCase() })}
        />
        <Textfeld
          etikett="Kreditinstitut"
          value={daten.sepaBank ?? ""}
          onChange={(e) => setze({ sepaBank: e.target.value })}
        />
      </Gitter>
    </div>
  );
}
