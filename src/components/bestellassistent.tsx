"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { OptionId, PaketId, paketById } from "@/lib/katalog";
import { berechnePreis, euro } from "@/lib/preis";
import type { Stammdaten } from "@/lib/stammdaten";
import { Bestellung, Pflegegrad, Schritt } from "@/lib/typen";
import {
  bestellungSchema,
  fehlerZuordnung,
  geburtsdatumFehler,
  ibanGueltig,
  telefonFehler,
} from "@/lib/validierung";

import { Kontrollkaestchen, Fortschritt, Textfeld } from "./formular";
import {
  Entwurf,
  Fehler,
  Preiszusammenfassung,
  SchrittAnschluss,
  SchrittKontaktpersonen,
  SchrittKostentraeger,
  SchrittPaket,
  SchrittTeilnehmer,
  SchrittZahlung,
  SchrittZugang,
} from "./schritte";
import { Unterschriftenfeld } from "./unterschrift";
import { Hinweisbox, Karte, Knopf } from "./ui";

interface SchrittDefinition {
  id: Schritt;
  titel: string;
  pruefe: (daten: Entwurf) => Fehler;
}

const ABLAUF: SchrittDefinition[] = [
  { id: "kostentraeger", titel: "Wer bestellt und wer zahlt", pruefe: pruefeKostentraeger },
  { id: "paket", titel: "Ihr Paket", pruefe: pruefePaket },
  { id: "teilnehmer", titel: "Angaben zur Person", pruefe: pruefeTeilnehmer },
  { id: "anschluss", titel: "Technischer Anschluss", pruefe: pruefeAnschluss },
  { id: "kontaktpersonen", titel: "Kontaktpersonen", pruefe: pruefeKontaktpersonen },
  { id: "zugang", titel: "Zugang und Notfallangaben", pruefe: () => ({}) },
  { id: "zahlung", titel: "Bankverbindung", pruefe: pruefeZahlung },
  { id: "zusammenfassung", titel: "Prüfen und unterschreiben", pruefe: () => ({}) },
];

/**
 * Ordnet einen Fehlerpfad dem Schritt zu, auf dem das Feld steht.
 *
 * Nötig für die Endprüfung: die schlägt auf der Zusammenfassung an, kann aber
 * Felder betreffen, die weit vorher stehen. Ohne diese Zuordnung sähe der
 * Kunde nur "Es fehlt etwas" und fände nirgends ein rot markiertes Feld.
 */
function schrittZuFehler(pfad: string): Schritt {
  const wurzel = pfad.split(".")[0]!;
  if (
    wurzel === "besteller" ||
    [
      "bestellerIstTeilnehmer",
      "pflegegrad",
      "kostenuebernahme",
      "pflegekasseName",
      "pflegekasseAnschrift",
      "versichertennummer",
      "grundAlleinlebend",
      "grundNotsituation",
      "vdkMitglied",
      "vdkMitgliedsnummer",
    ].includes(wurzel)
  ) {
    return "kostentraeger";
  }
  if (wurzel === "paketId" || wurzel === "optionen") return "paket";
  if (wurzel === "teilnehmer") return "teilnehmer";
  if (["anschlussart", "telefonanbieter", "geraeteRufnummer"].includes(wurzel)) {
    return "anschluss";
  }
  if (wurzel === "kontaktpersonen") return "kontaktpersonen";
  if (
    [
      "keySafeStandortWunsch",
      "zugangshinweise",
      "hausarztName",
      "hausarztTelefon",
      "notfallhinweise",
    ].includes(wurzel)
  ) {
    return "zugang";
  }
  if (wurzel.startsWith("sepa") || wurzel === "zahlungspflichtigerIstTeilnehmer") {
    return "zahlung";
  }
  // bestaetigungen, unterschrift, unterschriftOrt
  return "zusammenfassung";
}

const START: Entwurf = {
  bestellerIstTeilnehmer: undefined,
  pflegegrad: undefined,
  kostenuebernahme: false,
  pflegekasseName: "",
  pflegekasseAnschrift: "",
  versichertennummer: "",
  grundAlleinlebend: false,
  grundNotsituation: false,
  optionen: [],
  teilnehmer: {
    anrede: "Frau",
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    strasse: "",
    plz: "",
    ort: "",
    telefon: "",
    email: "",
  },
  telefonanbieter: "",
  geraeteRufnummer: "",
  kontaktpersonen: [],
  keySafeStandortWunsch: "",
  zugangshinweise: "",
  hausarztName: "",
  hausarztTelefon: "",
  notfallhinweise: "",
  vdkMitglied: false,
  vdkMitgliedsnummer: "",
  zahlungspflichtigerIstTeilnehmer: true,
  sepaKontoinhaber: "",
  sepaAnschrift: "",
  sepaIban: "",
  sepaBic: "",
  sepaBank: "",
  unterschrift: "",
  unterschriftOrt: "",
  bestaetigungen: {
    leistungenUndGeraete: false,
    kosten: false,
    hinweisePunkt4und5: false,
    datenblatt: false,
    schluesselAushaendigung: false,
    empfangsberechtigte: false,
    sepaMandat: false,
    widerrufsbelehrung: false,
    sofortigeErbringung: false,
    schweigepflichtentbindung: false,
    gesundheitsdaten: false,
    vdk: false,
    vollmachtPflegekasse: false,
    agb: false,
    datenschutz: false,
  },
};

export function Bestellassistent({
  stammdaten,
  vorbelegung,
  fortsetzenToken,
}: {
  stammdaten: Stammdaten;
  vorbelegung: Partial<Entwurf>;
  fortsetzenToken?: string;
}) {
  const [daten, setDaten] = useState<Entwurf>({ ...START, ...vorbelegung });
  const [index, setIndex] = useState(0);
  const [fehler, setFehler] = useState<Fehler>({});
  const [token, setToken] = useState<string | undefined>(fortsetzenToken);
  const [laedt, setLaedt] = useState(Boolean(fortsetzenToken));
  const [sendet, setSendet] = useState(false);
  const [sendefehler, setSendefehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  // Zählt jede fehlgeschlagene Prüfung; steuert den Sprung zum ersten Fehler.
  const [fehlerLauf, setFehlerLauf] = useState(0);
  const sitzungId = useRef<string>("");

  const schritt = ABLAUF[index];

  // Sitzungskennung nur für die Trichteransicht: bleibt im Tab, kein Cookie.
  useEffect(() => {
    let vorhanden = sessionStorage.getItem("hnr-sitzung");
    if (!vorhanden) {
      vorhanden = crypto.randomUUID();
      sessionStorage.setItem("hnr-sitzung", vorhanden);
    }
    sitzungId.current = vorhanden;
  }, []);

  const melde = useCallback(
    (schrittId: Schritt, art: "angesehen" | "abgeschlossen") => {
      if (!sitzungId.current) return;
      const breite = window.innerWidth;
      navigator.sendBeacon?.(
        "/api/ereignis",
        new Blob(
          [
            JSON.stringify({
              sitzungId: sitzungId.current,
              schritt: schrittId,
              art,
              geraet: breite < 640 ? "handy" : breite < 1024 ? "tablet" : "rechner",
              quelle: document.referrer ? new URL(document.referrer).host : undefined,
            }),
          ],
          { type: "application/json" },
        ),
      );
    },
    [],
  );

  useEffect(() => {
    melde(schritt.id, "angesehen");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [schritt.id, melde]);

  // Nach einer fehlgeschlagenen Prüfung zum ersten beanstandeten Feld
  // springen. Die kurze Verzögerung lässt einen eventuellen Schrittwechsel
  // zuerst zeichnen, damit das Feld auch wirklich im Dokument steht.
  useEffect(() => {
    if (fehlerLauf === 0) return;
    const uhr = setTimeout(() => {
      const ziel = document.querySelector<HTMLElement>(
        '[aria-invalid="true"], .fehlertext',
      );
      if (!ziel) return;
      ziel.scrollIntoView({ behavior: "smooth", block: "center" });
      if (
        ziel instanceof HTMLInputElement ||
        ziel instanceof HTMLSelectElement ||
        ziel instanceof HTMLTextAreaElement
      ) {
        ziel.focus({ preventScroll: true });
      }
    }, 120);
    return () => clearTimeout(uhr);
  }, [fehlerLauf]);

  // Vorhandenen Entwurf laden.
  useEffect(() => {
    if (!fortsetzenToken) return;
    fetch(`/api/entwurf?token=${fortsetzenToken}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ungültig"))))
      .then((entwurf) => {
        setDaten((alt) => ({ ...alt, ...entwurf.daten }));
        const gefunden = ABLAUF.findIndex((s) => s.id === entwurf.schritt);
        if (gefunden >= 0) setIndex(gefunden);
      })
      .catch(() => setSendefehler("Dieser Link ist abgelaufen. Bitte beginnen Sie neu."))
      .finally(() => setLaedt(false));
  }, [fortsetzenToken]);

  function setze(aenderung: Partial<Bestellung>) {
    setDaten((alt) => ({ ...alt, ...aenderung }));
    // Fehler der geänderten Felder sofort ausblenden.
    setFehler((alt) => {
      const neu = { ...alt };
      for (const schluessel of Object.keys(aenderung)) {
        for (const pfad of Object.keys(neu)) {
          if (pfad === schluessel || pfad.startsWith(`${schluessel}.`)) delete neu[pfad];
        }
      }
      return neu;
    });
  }

  async function speichereEntwurf(naechsterSchritt: Schritt, aktuelleDaten: Entwurf) {
    try {
      const antwort = await fetch("/api/entwurf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          sitzungId: sitzungId.current,
          schritt: naechsterSchritt,
          daten: aktuelleDaten,
          email: aktuelleDaten.besteller?.email || aktuelleDaten.teilnehmer?.email || "",
        }),
      });
      if (antwort.ok) {
        const ergebnis = await antwort.json();
        setToken(ergebnis.token);
      }
    } catch {
      // Ohne Zwischenspeicher lässt sich trotzdem weiterarbeiten.
    }
  }

  function weiter() {
    const gefunden = schritt.pruefe(daten);
    if (Object.keys(gefunden).length > 0) {
      setFehler(gefunden);
      setFehlerLauf((n) => n + 1);
      return;
    }
    setSendefehler(null);
    melde(schritt.id, "abgeschlossen");
    const naechster = ABLAUF[Math.min(index + 1, ABLAUF.length - 1)];
    void speichereEntwurf(naechster.id, daten);
    setIndex((i) => Math.min(i + 1, ABLAUF.length - 1));
  }

  function zurueck() {
    setFehler({});
    setIndex((i) => Math.max(i - 1, 0));
  }

  async function abschicken() {
    const geprueft = bestellungSchema.safeParse(vervollstaendige(daten));
    if (!geprueft.success) {
      const zuordnung = fehlerZuordnung(geprueft.error);
      setFehler(zuordnung);
      setFehlerLauf((n) => n + 1);

      // Zum frühesten betroffenen Schritt zurückspringen, sonst stünde der
      // Kunde vor einer Meldung ohne zugehöriges Feld.
      const betroffen = Object.keys(zuordnung)
        .map((pfad) => ABLAUF.findIndex((s) => s.id === schrittZuFehler(pfad)))
        .filter((i) => i >= 0);
      const frueheste = betroffen.length ? Math.min(...betroffen) : index;

      if (frueheste < index) {
        setIndex(frueheste);
        setSendefehler(
          `Im Schritt „${ABLAUF[frueheste].titel}“ fehlt noch etwas. Wir haben Sie dorthin zurückgebracht – das betroffene Feld ist rot markiert.`,
        );
      } else {
        setSendefehler(
          "Einige Angaben fehlen noch. Die betroffenen Felder sind rot markiert.",
        );
      }
      return;
    }

    setSendet(true);
    setSendefehler(null);
    try {
      const antwort = await fetch("/api/bestellung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestellung: geprueft.data, token }),
      });
      const ergebnis = await antwort.json();
      if (!antwort.ok) {
        setFehler(ergebnis.felder ?? {});
        setSendefehler(ergebnis.fehler ?? "Der Vertrag konnte nicht abgeschlossen werden.");
        return;
      }
      // Zwei Meldungen: Die Zusammenfassung ist beendet – ohne sie stünde sie
      // im Trichter als Totalabsprung, obwohl hier gerade der Vertrag zustande
      // kam. Und der Abschluss selbst.
      melde(schritt.id, "abgeschlossen");
      melde("abgeschlossen", "abgeschlossen");
      setErfolg(ergebnis.vorgangsnummer);
    } catch {
      setSendefehler(
        "Die Verbindung wurde unterbrochen. Bitte versuchen Sie es noch einmal.",
      );
    } finally {
      setSendet(false);
    }
  }

  if (erfolg) return <Abschluss vorgangsnummer={erfolg} stammdaten={stammdaten} />;

  if (laedt) {
    return (
      <Karte>
        <p className="text-sm text-tinte-600">Ihr gespeicherter Stand wird geladen …</p>
      </Karte>
    );
  }

  const gemeinsam = { daten, setze, fehler };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Fortschritt schritt={index + 1} gesamt={ABLAUF.length} titel={schritt.titel} />

      <Karte>
        {schritt.id === "kostentraeger" && <SchrittKostentraeger {...gemeinsam} />}
        {schritt.id === "paket" && <SchrittPaket {...gemeinsam} />}
        {schritt.id === "teilnehmer" && <SchrittTeilnehmer {...gemeinsam} />}
        {schritt.id === "anschluss" && <SchrittAnschluss {...gemeinsam} />}
        {schritt.id === "kontaktpersonen" && <SchrittKontaktpersonen {...gemeinsam} />}
        {schritt.id === "zugang" && <SchrittZugang {...gemeinsam} />}
        {schritt.id === "zahlung" && <SchrittZahlung {...gemeinsam} />}
        {schritt.id === "zusammenfassung" && (
          <SchrittZusammenfassung {...gemeinsam} stammdaten={stammdaten} />
        )}

        {sendefehler && (
          <div className="mt-6">
            <Hinweisbox art="warnung">{sendefehler}</Hinweisbox>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-tinte-200 pt-6">
          <Knopf art="still" type="button" onClick={zurueck} disabled={index === 0}>
            Zurück
          </Knopf>
          {schritt.id === "zusammenfassung" ? (
            <Knopf type="button" onClick={abschicken} disabled={sendet}>
              {sendet ? "Vertrag wird erstellt …" : "Zahlungspflichtig bestellen"}
            </Knopf>
          ) : (
            <Knopf type="button" onClick={weiter}>
              Weiter
            </Knopf>
          )}
        </div>
      </Karte>

      {token && (
        <p className="mt-4 text-center text-xs text-tinte-500">
          Ihr Zwischenstand ist gespeichert. Sie können die Bestellung jederzeit
          unterbrechen und über den Link in Ihrer E-Mail fortsetzen.
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------- Zusammenfassung

function SchrittZusammenfassung({
  daten,
  setze,
  fehler,
  stammdaten,
}: {
  daten: Entwurf;
  setze: (a: Partial<Bestellung>) => void;
  fehler: Fehler;
  stammdaten: Stammdaten;
}) {
  const paket = paketById((daten.paketId ?? "komfortpaket") as PaketId);
  const preis = berechnePreis({
    paketId: paket.id,
    optionen: (daten.optionen ?? []) as OptionId[],
    kostenuebernahme: Boolean(daten.kostenuebernahme),
    vdkMitglied: Boolean(daten.vdkMitglied),
  });
  const b = daten.bestaetigungen!;
  const setzeB = (feld: keyof typeof b, wert: boolean) =>
    setze({ bestaetigungen: { ...b, [feld]: wert } });

  const t = daten.teilnehmer!;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-base font-semibold text-tinte-900">Ihre Angaben</h3>
        <dl className="divide-y divide-tinte-200 rounded-lg border border-tinte-200 text-sm">
          <Zeile
            bezeichnung="Teilnehmer"
            wert={`${t.vorname} ${t.nachname}, geb. ${t.geburtsdatum}`}
          />
          <Zeile bezeichnung="Anschrift" wert={`${t.strasse}, ${t.plz} ${t.ort}`} />
          <Zeile
            bezeichnung="Pflegegrad"
            wert={
              daten.pflegegrad === "ohne"
                ? "kein Pflegegrad"
                : `Pflegegrad ${daten.pflegegrad}${daten.kostenuebernahme ? " · Kostenübernahme wird beantragt" : ""}`
            }
          />
          <Zeile bezeichnung="Paket" wert={paket.name} />
          {preis.zusatz.length > 0 && (
            <Zeile
              bezeichnung="Zusatzleistungen"
              wert={preis.zusatz.map((p) => p.bezeichnung).join(", ")}
            />
          )}
          <Zeile
            bezeichnung="Kontaktpersonen"
            wert={(daten.kontaktpersonen ?? []).map((k) => k.name).join(", ") || "—"}
          />
          <Zeile
            bezeichnung="Bankverbindung"
            wert={`${daten.sepaKontoinhaber} · ${maskiereIban(daten.sepaIban ?? "")}`}
          />
        </dl>
      </section>

      <Preiszusammenfassung preis={preis} paketName={paket.name} />

      <section>
        <h3 className="mb-1 text-base font-semibold text-tinte-900">
          Vertragsunterlagen
        </h3>
        <p className="mb-3 text-sm text-tinte-600">
          Bitte bestätigen Sie die folgenden Punkte. Sie erhalten alle Unterlagen
          anschließend als PDF per E-Mail.
        </p>
        <div className="space-y-3 rounded-lg border border-tinte-200 p-4">
          <Kontrollkaestchen
            etikett="Ich bestätige die Auswahl der Leistungen und der Geräteausstattung."
            checked={b.leistungenUndGeraete}
            fehler={fehler["bestaetigungen.leistungenUndGeraete"]}
            onChange={(e) => setzeB("leistungenUndGeraete", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett={`Ich bestätige die gebuchten Leistungen zu einmaligen Kosten von ${euro(preis.summe.einmalig)} und monatlichen Kosten von ${euro(preis.summe.monatlich)}.`}
            checked={b.kosten}
            fehler={fehler["bestaetigungen.kosten"]}
            onChange={(e) => setzeB("kosten", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett="Ich bestätige meine Angaben im Datenblatt (Person, Kontaktpersonen, Angaben für die Notrufzentrale)."
            checked={b.datenblatt}
            fehler={fehler["bestaetigungen.datenblatt"]}
            onChange={(e) => setzeB("datenblatt", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett={
              <>
                Ich habe die{" "}
                <Link href="/agb" target="_blank" className="underline underline-offset-2">
                  Allgemeinen Geschäftsbedingungen
                </Link>{" "}
                und die Hinweise unter Punkt 4 und 5 des Vertrags zur Kenntnis genommen
                und stimme ihnen zu.
              </>
            }
            checked={b.agb && b.hinweisePunkt4und5}
            fehler={fehler["bestaetigungen.agb"] ?? fehler["bestaetigungen.hinweisePunkt4und5"]}
            onChange={(e) => {
              setze({
                bestaetigungen: {
                  ...b,
                  agb: e.target.checked,
                  hinweisePunkt4und5: e.target.checked,
                },
              });
            }}
          />
          <Kontrollkaestchen
            etikett={
              <>
                Ich habe die{" "}
                <Link
                  href="/datenschutz"
                  target="_blank"
                  className="underline underline-offset-2"
                >
                  Datenschutzhinweise
                </Link>{" "}
                zur Kenntnis genommen.
              </>
            }
            checked={b.datenschutz}
            fehler={fehler["bestaetigungen.datenschutz"]}
            onChange={(e) => setzeB("datenschutz", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett="Ich erteile das SEPA-Lastschriftmandat und bestätige die Bankverbindung."
            checked={b.sepaMandat}
            fehler={fehler["bestaetigungen.sepaMandat"]}
            onChange={(e) => setzeB("sepaMandat", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett={
              <>
                Ich habe die{" "}
                <Link
                  href="/widerruf"
                  target="_blank"
                  className="underline underline-offset-2"
                >
                  Widerrufsbelehrung
                </Link>{" "}
                zur Kenntnis genommen.
              </>
            }
            checked={b.widerrufsbelehrung}
            fehler={fehler["bestaetigungen.widerrufsbelehrung"]}
            onChange={(e) => setzeB("widerrufsbelehrung", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett="Ich wünsche ausdrücklich, dass mit der Leistung bereits vor Ablauf der Widerrufsfrist begonnen wird."
            hinweis="Ohne diesen Wunsch beginnen wir erst nach 14 Tagen mit der Installation."
            checked={b.sofortigeErbringung}
            onChange={(e) => setzeB("sofortigeErbringung", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett={`Ich entbinde das BRK gegenüber ${stammdaten.schweigepflichtentbindung.slice(0, 3).join(", ")} und weiteren im Vertrag genannten Stellen von der Schweigepflicht.`}
            hinweis="Ohne diese Entbindung kann es im Notfall zu Verzögerungen kommen."
            checked={b.schweigepflichtentbindung}
            onChange={(e) => setzeB("schweigepflichtentbindung", e.target.checked)}
          />
          <Kontrollkaestchen
            etikett="Ich erteile die Vollmacht, den Antrag auf Kostenübernahme bei der Pflegekasse in meinem Namen zu stellen."
            checked={b.vollmachtPflegekasse}
            fehler={fehler["bestaetigungen.vollmachtPflegekasse"]}
            onChange={(e) => setzeB("vollmachtPflegekasse", e.target.checked)}
          />
          {daten.vdkMitglied && (
            <Kontrollkaestchen
              etikett="Ich habe die Erläuterungen zum VdK-Rabatt erhalten und stimme ihnen zu."
              checked={b.vdk}
              onChange={(e) => setzeB("vdk", e.target.checked)}
            />
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-base font-semibold text-tinte-900">Unterschrift</h3>
        <p className="mb-4 text-sm text-tinte-600">
          {daten.bestellerIstTeilnehmer
            ? "Bitte unterschreiben Sie den Vertrag."
            : `Bitte unterschreiben Sie als bevollmächtigte Person für ${t.vorname} ${t.nachname}.`}
        </p>
        <div className="mb-4 max-w-xs">
          <Textfeld
            etikett="Ort"
            pflicht
            placeholder="z. B. Obernburg"
            value={daten.unterschriftOrt ?? ""}
            fehler={fehler["unterschriftOrt"]}
            onChange={(e) => setze({ unterschriftOrt: e.target.value })}
          />
        </div>
        <Unterschriftenfeld onAendern={(bild) => setze({ unterschrift: bild ?? "" })} />
        {fehler["unterschrift"] && <p className="fehlertext">{fehler["unterschrift"]}</p>}
      </section>

      <Hinweisbox>
        Mit dem Klick auf „Zahlungspflichtig bestellen“ schließen Sie einen
        kostenpflichtigen Vertrag über {euro(preis.summe.monatlich)} monatlich
        {preis.summe.einmalig > 0 && ` und ${euro(preis.summe.einmalig)} einmalig`}.
      </Hinweisbox>
    </div>
  );
}

function Zeile({ bezeichnung, wert }: { bezeichnung: string; wert: string }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5">
      <dt className="w-40 shrink-0 text-tinte-500">{bezeichnung}</dt>
      <dd className="min-w-0 flex-1 text-tinte-800">{wert}</dd>
    </div>
  );
}

function maskiereIban(iban: string): string {
  const sauber = iban.replace(/\s+/g, "");
  if (sauber.length < 8) return sauber;
  return `${sauber.slice(0, 4)} •••• ${sauber.slice(-4)}`;
}

// -------------------------------------------------------- Abschlussseite

function Abschluss({
  vorgangsnummer,
  stammdaten,
}: {
  vorgangsnummer: string;
  stammdaten: Stammdaten;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Karte>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-brk-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 6L9 17l-5-5"
              stroke="var(--color-brk-600)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-tinte-900">Vielen Dank — der Vertrag ist geschlossen.</h1>
        <p className="mt-2 text-tinte-600">
          Ihre Vorgangsnummer lautet <strong>{vorgangsnummer}</strong>. Den vollständigen
          Vertrag haben wir Ihnen soeben per E-Mail geschickt.
        </p>

        <h2 className="mt-8 mb-3 text-base font-semibold text-tinte-900">
          Wie geht es weiter?
        </h2>
        <ol className="space-y-3 text-sm text-tinte-600">
          <li className="flex gap-3">
            <span className="font-semibold text-brk-700">1.</span>
            Wir melden uns in den nächsten Arbeitstagen und vereinbaren einen Termin für
            die Installation.
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-brk-700">2.</span>
            Beim Termin richten wir das Gerät ein, bringen den Schlüsseltresor an und
            weisen in die Bedienung ein.
          </li>
          <li className="flex gap-3">
            <span className="font-semibold text-brk-700">3.</span>
            Danach ist der Hausnotruf rund um die Uhr für Sie da.
          </li>
        </ol>

        <div className="mt-8 rounded-lg border border-tinte-200 bg-tinte-50 p-4 text-sm text-tinte-600">
          <p className="font-medium text-tinte-800">Sie haben Fragen?</p>
          <p className="mt-1">
            {stammdaten.hausnotrufbeauftragter.split(",")[0]} ist unter{" "}
            <a
              href={`tel:${stammdaten.telefon.replace(/[^+\d]/g, "")}`}
              className="underline underline-offset-2"
            >
              {stammdaten.telefon}
            </a>{" "}
            für Sie erreichbar.
          </p>
        </div>
      </Karte>
    </div>
  );
}

// -------------------------------------------------------- Prüfungen je Schritt

function pruefeKostentraeger(daten: Entwurf): Fehler {
  const fehler: Fehler = {};
  if (daten.bestellerIstTeilnehmer === undefined) {
    fehler["bestellerIstTeilnehmer"] = "Bitte wählen Sie eine der beiden Möglichkeiten.";
  }
  if (daten.bestellerIstTeilnehmer === false) {
    const b = daten.besteller;
    if (!b?.vorname?.trim()) fehler["besteller.vorname"] = "Bitte ausfüllen.";
    if (!b?.nachname?.trim()) fehler["besteller.nachname"] = "Bitte ausfüllen.";
    const telefon = telefonFehler(b?.telefon);
    if (telefon) fehler["besteller.telefon"] = telefon;
    if (!b?.email?.includes("@"))
      fehler["besteller.email"] = "Bitte eine gültige E-Mail-Adresse angeben.";
    if (!b?.bevollmaechtigt)
      fehler["besteller.bevollmaechtigt"] =
        "Bitte bestätigen Sie, dass Sie für die Person handeln dürfen.";
  }
  if (!daten.pflegegrad) fehler["pflegegrad"] = "Bitte auswählen.";
  if (daten.kostenuebernahme) {
    if (!daten.pflegekasseName?.trim())
      fehler["pflegekasseName"] = "Bitte die Pflegekasse angeben.";
    if (!daten.versichertennummer?.trim())
      fehler["versichertennummer"] = "Bitte die Versichertennummer angeben.";
    if (!daten.grundAlleinlebend && !daten.grundNotsituation)
      fehler["grundAlleinlebend"] = "Die Pflegekasse verlangt mindestens einen Grund.";
  }
  if (daten.vdkMitglied && !daten.vdkMitgliedsnummer?.trim())
    fehler["vdkMitgliedsnummer"] = "Bitte die Mitgliedsnummer angeben.";
  return fehler;
}

function pruefePaket(daten: Entwurf): Fehler {
  return daten.paketId ? {} : { paketId: "Bitte wählen Sie ein Paket." };
}

function pruefeTeilnehmer(daten: Entwurf): Fehler {
  const fehler: Fehler = {};
  const t = daten.teilnehmer;
  if (!t?.vorname?.trim()) fehler["teilnehmer.vorname"] = "Bitte ausfüllen.";
  if (!t?.nachname?.trim()) fehler["teilnehmer.nachname"] = "Bitte ausfüllen.";
  const geburtsdatum = geburtsdatumFehler(t?.geburtsdatum);
  if (geburtsdatum) fehler["teilnehmer.geburtsdatum"] = geburtsdatum;
  if (!t?.strasse?.trim()) fehler["teilnehmer.strasse"] = "Bitte ausfüllen.";
  if (!/^\d{5}$/.test(t?.plz ?? ""))
    fehler["teilnehmer.plz"] = "Die Postleitzahl hat fünf Ziffern.";
  if (!t?.ort?.trim()) fehler["teilnehmer.ort"] = "Bitte ausfüllen.";
  const telefon = telefonFehler(t?.telefon);
  if (telefon) fehler["teilnehmer.telefon"] = telefon;
  if (daten.bestellerIstTeilnehmer && !t?.email?.includes("@"))
    fehler["teilnehmer.email"] = "Für die Vertragsunterlagen brauchen wir eine E-Mail-Adresse.";
  if (t?.email && t.email.length > 0 && !t.email.includes("@"))
    fehler["teilnehmer.email"] = "Bitte eine gültige E-Mail-Adresse angeben.";
  return fehler;
}

function pruefeAnschluss(daten: Entwurf): Fehler {
  return daten.anschlussart ? {} : { anschlussart: "Bitte wählen Sie eine Möglichkeit." };
}

function pruefeKontaktpersonen(daten: Entwurf): Fehler {
  const fehler: Fehler = {};
  const personen = daten.kontaktpersonen ?? [];
  if (personen.length === 0) {
    fehler["kontaktpersonen"] = "Bitte mindestens eine Kontaktperson angeben.";
    return fehler;
  }
  personen.forEach((p, i) => {
    if (!p.name.trim()) fehler[`kontaktpersonen.${i}.name`] = "Bitte ausfüllen.";
    const telefon = telefonFehler(p.telefon);
    if (telefon) fehler[`kontaktpersonen.${i}.telefon`] = telefon;
  });
  return fehler;
}

function pruefeZahlung(daten: Entwurf): Fehler {
  const fehler: Fehler = {};
  if (!daten.sepaKontoinhaber?.trim())
    fehler["sepaKontoinhaber"] = "Bitte den Kontoinhaber angeben.";
  if ((daten.sepaAnschrift ?? "").trim().length < 5)
    fehler["sepaAnschrift"] = "Bitte die Anschrift des Kontoinhabers angeben.";
  if (!ibanGueltig(daten.sepaIban ?? ""))
    fehler["sepaIban"] = "Diese IBAN ist nicht gültig. Bitte prüfen Sie die Eingabe.";
  return fehler;
}

/** Ergänzt Felder, die sich aus anderen Angaben ergeben, vor der Endprüfung. */
function vervollstaendige(daten: Entwurf): Entwurf {
  const kopie: Entwurf = { ...daten };
  if (kopie.pflegegrad === undefined) kopie.pflegegrad = "ohne" as Pflegegrad;
  if (!kopie.vdkMitglied) kopie.bestaetigungen = { ...kopie.bestaetigungen!, vdk: false };
  return kopie;
}
