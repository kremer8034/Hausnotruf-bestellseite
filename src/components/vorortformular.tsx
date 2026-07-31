"use client";

import { useState } from "react";

import { GESUNDHEIT_GEISTIG, GESUNDHEIT_KOERPERLICH } from "@/lib/pdf/felder";
import { Bestellung, VorOrtErfassung } from "@/lib/typen";

import { Kontrollkaestchen, Textbereich, Textfeld } from "./formular";
import { Unterschriftenfeld } from "./unterschrift";
import { Hinweisbox, Karte, Knopf } from "./ui";

const LEERES_GERAET = { bezeichnung: "", idNummer: "" };

function heute(): string {
  return new Date().toLocaleDateString("de-DE");
}

export function VorOrtFormular({
  vertragId,
  vorgangsnummer,
  bestellung,
  vorhanden,
  kaufpreisFaellig,
}: {
  vertragId: string;
  vorgangsnummer: string;
  bestellung: Bestellung;
  vorhanden: VorOrtErfassung | null;
  kaufpreisFaellig: boolean;
}) {
  const [d, setD] = useState<VorOrtErfassung>(
    vorhanden ?? {
      mietgeraete: [{ ...LEERES_GERAET }],
      technischeVoraussetzungen: "",
      gesundheit: {
        koerperlich: [],
        geistig: [],
        anmerkungKoerperlich: "",
        anmerkungGeistig: "",
        medikamente: "",
        medikamentenallergien: "",
      },
      datumInbetriebnahme: heute(),
      vorgangsnummer,
      versorgungAb: "",
      anwesendVertreter: Boolean(bestellung.besteller),
      anwesendBetreuer: false,
      anwesendSonstige: false,
      ortInbetriebnahme: bestellung.teilnehmer.ort,
      unterschriftLeistungserbringer: "",
      unterschriftTeilnehmer: "",
      kaufGeraete: kaufpreisFaellig
        ? [{ bezeichnung: "", seriennummer: "", kosten: "" }]
        : [],
    },
  );
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "info" | "warnung"; text: string } | null>(
    null,
  );
  const [fertig, setFertig] = useState(Boolean(vorhanden));

  const setzeG = (feld: keyof VorOrtErfassung["gesundheit"], wert: string | string[]) =>
    setD((alt) => ({ ...alt, gesundheit: { ...alt.gesundheit, [feld]: wert } }));

  function schalteDiagnose(bereich: "koerperlich" | "geistig", name: string) {
    const aktuell = d.gesundheit[bereich];
    setzeG(
      bereich,
      aktuell.includes(name) ? aktuell.filter((x) => x !== name) : [...aktuell, name],
    );
  }

  async function speichern() {
    if (!d.unterschriftLeistungserbringer || !d.unterschriftTeilnehmer) {
      setMeldung({
        art: "warnung",
        text: "Es fehlt noch eine Unterschrift — beide sind für die Kassenabrechnung nötig.",
      });
      return;
    }
    setLaeuft(true);
    setMeldung(null);
    try {
      const antwort = await fetch(`/api/vertrag/${vertragId}/vor-ort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const ergebnis = await antwort.json();
      if (!antwort.ok) throw new Error(ergebnis.fehler ?? "Speichern fehlgeschlagen");
      setFertig(true);
      setMeldung({
        art: "info",
        text: "Gespeichert. Der Gesamtvertrag liegt jetzt im Backoffice bereit.",
      });
    } catch (fehler) {
      setMeldung({ art: "warnung", text: (fehler as Error).message });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="space-y-5">
      {meldung && <Hinweisbox art={meldung.art}>{meldung.text}</Hinweisbox>}

      {fertig && !meldung && (
        <Hinweisbox>
          Dieser Termin ist bereits erfasst. Änderungen überschreiben die
          bisherigen Angaben.
        </Hinweisbox>
      )}

      <Karte>
        <h2 className="mb-1 text-base font-bold text-tinte-900">Eingebaute Geräte</h2>
        <p className="mb-4 text-sm text-tinte-500">
          Anlage 1 Teil 2 des Vertrags. Bezeichnung und ID beziehungsweise
          SIM-Nummer je Gerät.
        </p>
        <div className="space-y-3">
          {d.mietgeraete.map((g, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Textfeld
                etikett={`Gerät ${i + 1}`}
                placeholder="Hersteller und Modell"
                value={g.bezeichnung}
                onChange={(e) =>
                  setD({
                    ...d,
                    mietgeraete: d.mietgeraete.map((x, j) =>
                      j === i ? { ...x, bezeichnung: e.target.value } : x,
                    ),
                  })
                }
              />
              <Textfeld
                etikett="ID / SIM"
                value={g.idNummer}
                onChange={(e) =>
                  setD({
                    ...d,
                    mietgeraete: d.mietgeraete.map((x, j) =>
                      j === i ? { ...x, idNummer: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
        {d.mietgeraete.length < 5 && (
          <Knopf
            art="neben"
            type="button"
            className="mt-3"
            onClick={() => setD({ ...d, mietgeraete: [...d.mietgeraete, { ...LEERES_GERAET }] })}
          >
            Weiteres Gerät
          </Knopf>
        )}
        <div className="mt-4">
          <Textfeld
            etikett="Technische Voraussetzungen"
            hinweis={
              bestellung.anschlussart === "unbekannt"
                ? "Der Kunde konnte die Anschlussart nicht angeben — bitte hier eintragen."
                : "Ergänzung zur Angabe des Kunden, falls abweichend."
            }
            value={d.technischeVoraussetzungen}
            onChange={(e) => setD({ ...d, technischeVoraussetzungen: e.target.value })}
          />
        </div>
      </Karte>

      {kaufpreisFaellig && (
        <Karte>
          <h2 className="mb-1 text-base font-bold text-tinte-900">Kaufbeleg</h2>
          <p className="mb-4 text-sm text-tinte-500">
            Für Geräte, die der Teilnehmer kauft (Seite 26 des Vertrags).
          </p>
          <div className="space-y-3">
            {d.kaufGeraete.map((g, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-3">
                <Textfeld
                  etikett="Gerät"
                  value={g.bezeichnung}
                  onChange={(e) =>
                    setD({
                      ...d,
                      kaufGeraete: d.kaufGeraete.map((x, j) =>
                        j === i ? { ...x, bezeichnung: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Textfeld
                  etikett="Seriennummer"
                  value={g.seriennummer}
                  onChange={(e) =>
                    setD({
                      ...d,
                      kaufGeraete: d.kaufGeraete.map((x, j) =>
                        j === i ? { ...x, seriennummer: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Textfeld
                  etikett="Kosten"
                  inputMode="decimal"
                  placeholder="189,00"
                  value={g.kosten}
                  onChange={(e) =>
                    setD({
                      ...d,
                      kaufGeraete: d.kaufGeraete.map((x, j) =>
                        j === i ? { ...x, kosten: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Karte>
      )}

      <Karte>
        <h2 className="mb-1 text-base font-bold text-tinte-900">Gesundheitsangaben</h2>
        <p className="mb-4 text-sm text-tinte-500">
          Anlage 11. Bitte nur mit ausdrücklichem Einverständnis des Teilnehmers
          aufnehmen und nur, was für die Notrufzentrale von Bedeutung ist.
        </p>

        <h3 className="mb-2 text-sm font-semibold text-tinte-700">
          Körperliche Einschränkungen
        </h3>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {Object.keys(GESUNDHEIT_KOERPERLICH).map((name) => (
            <Kontrollkaestchen
              key={name}
              etikett={name}
              checked={d.gesundheit.koerperlich.includes(name)}
              onChange={() => schalteDiagnose("koerperlich", name)}
            />
          ))}
        </div>
        <div className="mt-3">
          <Textbereich
            etikett="Sonstige Anmerkungen"
            rows={2}
            value={d.gesundheit.anmerkungKoerperlich}
            onChange={(e) => setzeG("anmerkungKoerperlich", e.target.value)}
          />
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold text-tinte-700">
          Geistige und neurologische Einschränkungen
        </h3>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {Object.keys(GESUNDHEIT_GEISTIG).map((name) => (
            <Kontrollkaestchen
              key={name}
              etikett={name}
              checked={d.gesundheit.geistig.includes(name)}
              onChange={() => schalteDiagnose("geistig", name)}
            />
          ))}
        </div>
        <div className="mt-3 space-y-3">
          <Textbereich
            etikett="Sonstige Anmerkungen"
            rows={2}
            value={d.gesundheit.anmerkungGeistig}
            onChange={(e) => setzeG("anmerkungGeistig", e.target.value)}
          />
          <Textbereich
            etikett="Regelmäßig eingenommene Medikamente"
            rows={2}
            value={d.gesundheit.medikamente}
            onChange={(e) => setzeG("medikamente", e.target.value)}
          />
          <Textfeld
            etikett="Medikamentenallergien und Unverträglichkeiten"
            value={d.gesundheit.medikamentenallergien}
            onChange={(e) => setzeG("medikamentenallergien", e.target.value)}
          />
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-1 text-base font-bold text-tinte-900">Inbetriebnahme</h2>
        <p className="mb-4 text-sm text-tinte-500">
          Anlage 9: Empfangs- und Einweisungsbestätigung.
        </p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Textfeld
              etikett="Datum der Inbetriebnahme"
              placeholder="TT.MM.JJJJ"
              value={d.datumInbetriebnahme}
              onChange={(e) => setD({ ...d, datumInbetriebnahme: e.target.value })}
            />
            <Textfeld
              etikett="Ort"
              value={d.ortInbetriebnahme}
              onChange={(e) => setD({ ...d, ortInbetriebnahme: e.target.value })}
            />
          </div>
          {bestellung.kostenuebernahme && (
            <Textfeld
              etikett="Versorgung genehmigt ab"
              hinweis="Falls die Pflegekasse bereits zugestimmt hat."
              placeholder="TT.MM.JJJJ"
              value={d.versorgungAb}
              onChange={(e) => setD({ ...d, versorgungAb: e.target.value })}
            />
          )}
          <fieldset>
            <legend className="etikett">Anwesend war außer dem Teilnehmer</legend>
            <div className="space-y-2">
              <Kontrollkaestchen
                etikett="Gesetzliche Vertretung beziehungsweise bevollmächtigte Person"
                checked={d.anwesendVertreter}
                onChange={(e) => setD({ ...d, anwesendVertreter: e.target.checked })}
              />
              <Kontrollkaestchen
                etikett="Weitere an der Betreuung beteiligte Person"
                checked={d.anwesendBetreuer}
                onChange={(e) => setD({ ...d, anwesendBetreuer: e.target.checked })}
              />
              <Kontrollkaestchen
                etikett="Sonstige, zum Beispiel Nachbarn"
                checked={d.anwesendSonstige}
                onChange={(e) => setD({ ...d, anwesendSonstige: e.target.checked })}
              />
            </div>
          </fieldset>
        </div>
      </Karte>

      <Karte>
        <h2 className="mb-4 text-base font-bold text-tinte-900">Unterschriften</h2>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-tinte-700">
              Unterschrift Leistungserbringer (BRK)
            </p>
            <Unterschriftenfeld
              hinweis="Bestätigt die auftragsgemäße Installation und Inbetriebnahme."
              onAendern={(bild) =>
                setD({ ...d, unterschriftLeistungserbringer: bild ?? "" })
              }
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-tinte-700">
              Unterschrift Teilnehmer beziehungsweise Vertretung
            </p>
            <Unterschriftenfeld
              hinweis="Bestätigt Empfang, Einweisung und Rückgabeverpflichtung."
              onAendern={(bild) => setD({ ...d, unterschriftTeilnehmer: bild ?? "" })}
            />
          </div>
        </div>
      </Karte>

      <Knopf breit type="button" onClick={speichern} disabled={laeuft}>
        {laeuft ? "Wird gespeichert …" : "Installation abschließen"}
      </Knopf>
    </div>
  );
}
