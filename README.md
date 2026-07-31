# Hausnotruf-Bestellseite

Online-Bestellstrecke für den BRK-Servicevertrag Hausnotruf/Mobilruf des
BRK-Kreisverbands Miltenberg-Obernburg. Kunden schließen den Vertrag im Netz ab
und unterschreiben digital; die Anwendung befüllt das Vertrags-PDF des
Kreisverbands eins zu eins und verschickt es an Kunde und Backoffice.

## Was die Anwendung kann

- **Startseite mit Preisrechner** — der Beitrag steht fest, bevor jemand
  persönliche Daten eintippt
- **Achtstufiger Bestellassistent** für Angehörige, mobiltauglich, mit
  „Speichern und später weitermachen" sowie Erinnerungsmail nach Abbruch
- **Digitale Unterschrift**, die an den Positionen der ursprünglichen
  Signaturfelder in den Vertrag gestempelt wird
- **Automatische Vertragserstellung** über alle 27 Seiten inklusive SEPA-Mandat,
  Widerrufsunterlagen, Schweigepflichtentbindung und — bei Pflegekassenkunden —
  Beratungsdokumentation und Antrag auf Kostenübernahme
- **Backoffice** mit Vertragsliste, Suche, Statusverwaltung, Trichteransicht und
  CSV-Export
- **Technikbereich** für den Termin vor Ort: Geräteliste, Gesundheitsangaben
  nach Anlage 11, Inbetriebnahme und zwei weitere Unterschriften; daraus
  entsteht der Gesamtvertrag

## Warum der Vertrag in zwei Teilen entsteht

Der Vertrag lässt sich nicht vollständig online abschließen: Geräteliste mit
Seriennummern, Schlüsseltresor und die Empfangs- und Einweisungsbestätigung
(Anlage 9) setzen die Anwesenheit vor Ort voraus. Die Anwendung teilt deshalb
auf:

1. **Online** — Vertrag Seiten 1 bis 3, Datenblatt Teil 1/3/5/6, SEPA-Mandat,
   Widerrufsunterlagen, Datenschutzhinweise, Schweigepflichtentbindung,
   VdK-Unterlage, Vollmacht Pflegekasse, Zusammenfassung mit Unterschrift
2. **Vor Ort** — Anlage 1 Teil 2 (Geräte), Anlage 11 (Gesundheitsdaten),
   Anlage 9 (Inbetriebnahme), gegebenenfalls Kaufbeleg

Der Gewinn liegt darin, dass nur noch **eine** Fahrt zum Kunden nötig ist: der
Techniker kommt mit einem bereits unterschriebenen Vertrag zur Installation.

## Aufbau

```
assets/vertrag/    Original-PDF, aufbereitete Vorlage, Signaturpositionen
docs/              Verarbeitungsverzeichnis, TOM, Betriebsanleitung
src/lib/           Katalog, Preislogik, Datenmodell, PDF-Befüllung, Datenbank
src/components/    Formularbausteine, Bestellassistent, Unterschriftenfeld
src/app/           Seiten und Schnittstellen
supabase/          Datenbankschema
tools/             Analyse und Aufbereitung des Vertrags-PDF (Python)
```

### Die drei Kernstücke

| Datei | Aufgabe |
|---|---|
| `src/lib/katalog.ts` | Pakete, Zusatzleistungen, Preise — Quelle ist die verbindliche Preisliste des Kreisverbands |
| `src/lib/pdf/felder.ts` | Zuordnung der Bestelldaten auf die 321 Formularfelder des Vertrags |
| `src/lib/pdf/fuellen.ts` | Befüllung, Unterschriftenstempel, Abflachung |

## Besonderheit: die Feldnamen des Vertrags

Das Vertrags-PDF ist ein AcroForm mit 333 Feldern. Ein Teil der Namen ist
irreführend vergeben, weshalb die Zuordnung **aus einer Positionsanalyse**
stammt und nicht aus den Namen:

| Feldname im PDF | Tatsächliche Bedeutung |
|---|---|
| `KV_Nummer` | Versichertennummer des Teilnehmers |
| `Preistabelle_B*` / `C*` / `D*` | Spalte monatlich / einmalig / jährlich |
| `Leistung_HNR 2` … `Leistung_MR_25` | Gesundheitsdaten auf Seite 22 |
| `Leistung_HNR 15` … `28` | Bestätigungshaken auf Seite 27 |
| `TN_Geburtsdatum 8` … `24` | Depot- und Kaufbelegfelder auf Seite 25/26 |

Zusätzlich tragen drei Felder denselben Namen bei unterschiedlicher Bedeutung
(etwa `Datum_Inbetriebnahme`, das auf Seite 17 das Beratungsdatum meint). Das
Skript `tools/prepare_template.py` trennt sie und entfernt die
Zertifikats-Signaturfelder, deren Positionen für den Unterschriftenstempel
gesichert werden.

```bash
python3 tools/analyze_pdf_fields.py 22   # Feldkarte, hier für Seite 22
python3 tools/prepare_template.py        # Vorlage neu erzeugen
npm run pdf:test                         # Beispielvertrag nach tmp/
```

Nach jeder neuen Vertragsfassung müssen beide Skripte laufen und das Test-PDF
geprüft werden.

## Einrichtung

Bereitstellung auf Vercel: [docs/vercel-einrichten.md](docs/vercel-einrichten.md)
Betrieb und Pflege: [docs/betrieb.md](docs/betrieb.md)

```bash
npm install
cp .env.example .env.local   # und ausfüllen
npm run dev
```

## Offene Punkte

Vor dem Echtbetrieb zu erledigen — die Anwendung weist im Backoffice unter
Einstellungen darauf hin:

- [ ] Echte IK-Nummer (neunstellig) eintragen — ohne sie keine Kassenabrechnung
- [ ] Echte SEPA-Gläubiger-Identifikationsnummer eintragen — ohne sie kein
      Lastschrifteinzug
- [ ] Adresse des Impressums eintragen
- [ ] BRK-Logo als Datei hinterlegen (derzeit als SVG nachgebildet)
- [ ] Datenschutzerklärung und Verarbeitungsverzeichnis freigeben
- [ ] Zuordnung Mobilrufpaket/Notrufuhr zu „Mobilruf mit/ohne Ortung"
      bestätigen (siehe Kommentare in `src/lib/katalog.ts`)
