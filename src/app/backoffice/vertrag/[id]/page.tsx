import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusWechsler } from "@/components/statuswechsler";
import { Karte } from "@/components/ui";
import { verlangeRolle } from "@/lib/auth";
import { db } from "@/lib/db";
import { OptionId, PaketId, optionById, paketById } from "@/lib/katalog";
import { euro } from "@/lib/preis";
import { Bestellung, VertragsStatus, VorOrtErfassung } from "@/lib/typen";

export const dynamic = "force-dynamic";

export default async function Vertragsdetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verlangeRolle(["admin", "mitarbeiter"]);
  const { id } = await params;

  const { data } = await db()
    .from("vertraege")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const b = data.daten as Bestellung;
  const vorOrt = data.vor_ort as VorOrtErfassung | null;
  const preis = data.preis as {
    summe: { monatlich: number; einmalig: number; jaehrlich: number };
    kostenErstesJahr: number;
  };
  const paket = sicheresPaket(b.paketId);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/backoffice"
            className="text-sm text-tinte-500 hover:text-brk-700"
          >
            ← Zurück zur Übersicht
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-tinte-900">
            {data.vorgangsnummer}
          </h1>
          <p className="mt-1 text-sm text-tinte-500">
            Abgeschlossen am{" "}
            {new Date(data.erstellt_am).toLocaleString("de-DE")}
            {data.unterschrift_ip && ` · unterschrieben von ${data.unterschrift_ip}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/backoffice/vertrag/${id}/pdf`}
            className="rounded-lg bg-brk-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brk-700"
          >
            Vertrag als PDF
          </a>
          <StatusWechsler id={id} status={data.status as VertragsStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Karte>
            <h2 className="mb-4 text-base font-bold text-tinte-900">Teilnehmer</h2>
            <Liste
              eintraege={[
                ["Name", `${b.teilnehmer.anrede} ${b.teilnehmer.vorname} ${b.teilnehmer.nachname}`],
                ["Geburtsdatum", b.teilnehmer.geburtsdatum],
                ["Anschrift", `${b.teilnehmer.strasse}, ${b.teilnehmer.plz} ${b.teilnehmer.ort}`],
                ["Telefon", b.teilnehmer.telefon],
                ["E-Mail", b.teilnehmer.email || "—"],
                [
                  "Pflegegrad",
                  b.pflegegrad === "ohne" ? "kein Pflegegrad" : `Pflegegrad ${b.pflegegrad}`,
                ],
              ]}
            />
          </Karte>

          {b.besteller && (
            <Karte>
              <h2 className="mb-4 text-base font-bold text-tinte-900">
                Bestellt durch
              </h2>
              <Liste
                eintraege={[
                  ["Name", `${b.besteller.anrede} ${b.besteller.vorname} ${b.besteller.nachname}`],
                  ["Telefon", b.besteller.telefon],
                  ["E-Mail", b.besteller.email],
                  ["Bevollmächtigt bestätigt", b.besteller.bevollmaechtigt ? "ja" : "nein"],
                ]}
              />
            </Karte>
          )}

          {b.kostenuebernahme && (
            <Karte>
              <h2 className="mb-4 text-base font-bold text-tinte-900">Pflegekasse</h2>
              <Liste
                eintraege={[
                  ["Kasse", b.pflegekasseName],
                  ["Anschrift", b.pflegekasseAnschrift || "—"],
                  ["Versichertennummer", b.versichertennummer],
                  [
                    "Begründung",
                    [
                      b.grundAlleinlebend && "alleinlebend",
                      b.grundNotsituation && "Notsituation zu erwarten",
                    ]
                      .filter(Boolean)
                      .join(", ") || "—",
                  ],
                ]}
              />
            </Karte>
          )}

          <Karte>
            <h2 className="mb-4 text-base font-bold text-tinte-900">Kontaktpersonen</h2>
            <div className="space-y-3">
              {b.kontaktpersonen.map((k, i) => (
                <div key={i} className="rounded-lg border border-tinte-200 p-3 text-sm">
                  <p className="font-medium text-tinte-900">
                    {k.name}
                    <span className="ml-2 text-xs font-normal text-tinte-500">
                      {k.bezugsart}
                    </span>
                  </p>
                  <p className="mt-0.5 text-tinte-600">
                    {k.telefon}
                    {k.anschrift && ` · ${k.anschrift}`}
                  </p>
                  <p className="mt-0.5 text-xs text-tinte-500">
                    Schlüssel vorhanden: {k.schluesselVorhanden ? "ja" : "nein"}
                  </p>
                </div>
              ))}
            </div>
          </Karte>

          <Karte>
            <h2 className="mb-4 text-base font-bold text-tinte-900">
              Zugang und Notfallangaben
            </h2>
            <Liste
              eintraege={[
                ["Schlüsseltresor", b.keySafeStandortWunsch || "—"],
                ["Zugangshinweise", b.zugangshinweise || "—"],
                [
                  "Hausarzt",
                  [b.hausarztName, b.hausarztTelefon].filter(Boolean).join(", ") || "—",
                ],
                ["Hinweise Notrufzentrale", b.notfallhinweise || "—"],
                ["Anschluss", b.anschlussart],
                ["Telefonanbieter", b.telefonanbieter || "—"],
              ]}
            />
          </Karte>

          <Karte>
            <h2 className="mb-1 text-base font-bold text-tinte-900">Vor Ort</h2>
            {vorOrt ? (
              <>
                <p className="mb-4 text-sm text-tinte-500">
                  Erfasst am{" "}
                  {data.vor_ort_am
                    ? new Date(data.vor_ort_am).toLocaleString("de-DE")
                    : "—"}
                </p>
                <Liste
                  eintraege={[
                    [
                      "Geräte",
                      vorOrt.mietgeraete
                        .filter((g) => g.bezeichnung)
                        .map((g) => `${g.bezeichnung} (${g.idNummer})`)
                        .join(", ") || "—",
                    ],
                    ["Inbetriebnahme", vorOrt.datumInbetriebnahme || "—"],
                    [
                      "Gesundheitsangaben",
                      [...vorOrt.gesundheit.koerperlich, ...vorOrt.gesundheit.geistig].join(
                        ", ",
                      ) || "—",
                    ],
                    ["Medikamente", vorOrt.gesundheit.medikamente || "—"],
                  ]}
                />
                {data.gesamt_pdf_pfad && (
                  <a
                    href={`/backoffice/vertrag/${id}/pdf?gesamt=1`}
                    className="mt-4 inline-block text-sm font-medium text-brk-700 hover:underline"
                  >
                    Gesamtvertrag inklusive Vor-Ort-Teil herunterladen
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-tinte-600">
                Der Vor-Ort-Teil ist noch offen. Der Techniker ergänzt Geräteliste,
                Gesundheitsangaben und Inbetriebnahme beim Installationstermin.
              </p>
            )}
          </Karte>
        </div>

        <div className="space-y-6">
          <Karte>
            <h2 className="mb-4 text-base font-bold text-tinte-900">Leistung</h2>
            <Liste
              eintraege={[
                ["Paket", paket],
                [
                  "Zusatzleistungen",
                  b.optionen.map(sichereOption).join(", ") || "keine",
                ],
                ["Kostenübernahme", b.kostenuebernahme ? "beantragt" : "nein"],
                ["Monatlich", euro(preis.summe.monatlich)],
                ["Einmalig", euro(preis.summe.einmalig)],
                ["Erstes Jahr", euro(preis.kostenErstesJahr)],
                [
                  "VdK",
                  b.vdkMitglied ? `ja (${b.vdkMitgliedsnummer})` : "nein",
                ],
              ]}
            />
          </Karte>

          <Karte>
            <h2 className="mb-4 text-base font-bold text-tinte-900">Bankverbindung</h2>
            <Liste
              eintraege={[
                ["Kontoinhaber", b.sepaKontoinhaber],
                ["Anschrift", b.sepaAnschrift],
                ["IBAN", b.sepaIban],
                ["BIC", b.sepaBic || "—"],
                ["Kreditinstitut", b.sepaBank || "—"],
                ["Mandatsreferenz", data.vorgangsnummer],
              ]}
            />
          </Karte>

          <Karte>
            <h2 className="mb-3 text-base font-bold text-tinte-900">Unterschrift</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.unterschrift}
              alt="Unterschrift des Kunden"
              className="w-full rounded border border-tinte-200 bg-white p-2"
            />
            <p className="mt-2 text-xs text-tinte-500">
              {new Date(data.unterschrift_zeit).toLocaleString("de-DE")}
              {data.unterschrift_ip && ` · ${data.unterschrift_ip}`}
            </p>
          </Karte>
        </div>
      </div>
    </>
  );
}

function Liste({ eintraege }: { eintraege: [string, string][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {eintraege.map(([bezeichnung, wert]) => (
        <div key={bezeichnung} className="flex flex-wrap gap-x-3">
          <dt className="w-44 shrink-0 text-tinte-500">{bezeichnung}</dt>
          <dd className="min-w-0 flex-1 break-words text-tinte-800">{wert}</dd>
        </div>
      ))}
    </dl>
  );
}

function sicheresPaket(id: string): string {
  try {
    return paketById(id as PaketId).name;
  } catch {
    return id;
  }
}

function sichereOption(id: string): string {
  try {
    return optionById(id as OptionId).name;
  } catch {
    return id;
  }
}
