# Einrichtung und Betrieb

## 1. Umgebungsvariablen

Anzulegen als `.env.local` (lokal) beziehungsweise als Umgebungsvariablen im
Vercel-Projekt.

| Variable | Zweck | Wo zu finden |
|---|---|---|
| `SUPABASE_URL` | Adresse des Supabase-Projekts | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverseitiger Vollzugriff. **Niemals im Browser verwenden.** | ebenda, Abschnitt `service_role` |
| `NEXT_PUBLIC_SUPABASE_URL` | dieselbe Adresse, für die Anmeldung | ebenda |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlicher Schlüssel für die Anmeldung | ebenda, Abschnitt `anon` |
| `NEXT_PUBLIC_BASIS_URL` | Adresse der Seite, z. B. `https://hausnotruf.example.de` | für die Links in den Erinnerungsmails |
| `CRON_SECRET` | schützt den täglichen Aufräumlauf | frei wählbar, z. B. `openssl rand -hex 32` |

Der `anon`-Schlüssel darf öffentlich sein: auf allen Tabellen ist Row Level
Security aktiv und es gibt keine Policy, er kommt also an keine Daten.

## 2. Datenbank einrichten

Das Schema liegt in `supabase/migrations/`. Die Dateien werden der Reihe nach
eingespielt, `0001_grundschema.sql` zuerst. Einspielen entweder über die
Supabase-Oberfläche (SQL Editor) oder mit der CLI:

```bash
supabase link --project-ref <projekt-ref>
supabase db push
```

Anschließend einen Storage-Bucket **`vertraege`** anlegen, **nicht öffentlich**.
Die Vertrags-PDF landen dort; ausgeliefert werden sie nur über eine Route, die
vorher die Anmeldung prüft.

## 3. Zugänge anlegen

Es gibt drei Rollen:

| Rolle | Darf |
|---|---|
| `admin` | alles, einschließlich Einstellungen und SMTP-Zugang |
| `mitarbeiter` | Verträge sehen, Status ändern, exportieren |
| `techniker` | Terminliste und Vor-Ort-Erfassung |

Verwaltet werden sie im Backoffice unter **Benutzer** — sichtbar nur für
Administratoren. Dort lassen sich Zugänge anlegen, umbenennen, in der Rolle
ändern, deaktivieren, löschen und mit einem neuen Passwort-Link versorgen.

Beim Anlegen ist **Einladung per E-Mail** voreingestellt: Die Person bekommt
einen Link und legt ihr Passwort selbst fest, der Link gilt sieben Tage. Wer
den Zugang lieber persönlich übergibt, entfernt den Haken und vergibt ein
Startpasswort (mindestens zehn Zeichen).

Zwei Grenzen sind fest eingebaut, damit sich niemand aussperrt:

- Die eigene Rolle lässt sich nicht ändern, der eigene Zugang nicht
  deaktivieren oder löschen.
- Der letzte aktive Administrator bleibt Administrator. Vorher muss ein
  zweiter angelegt werden.

Gelöscht werden kann nur, wer noch keine Installation erfasst hat — sonst ginge
der Nachweis verloren, wer das Gerät angeschlossen hat. Für alle anderen ist
**Deaktivieren** der richtige Weg: Die Anmeldung ist gesperrt, offene Sitzungen
werden sofort beendet, die Historie bleibt.

### Erster Zugang

Beim allerersten Mal gibt es noch keinen Administrator, der einladen könnte.
Dieser eine Zugang wird direkt in Supabase angelegt: unter **Authentication →
Users** einen Benutzer mit E-Mail und Passwort erstellen, danach im SQL Editor
das Profil ergänzen — ohne diesen Schritt ist keine Anmeldung möglich, selbst
mit richtigem Passwort:

```sql
insert into profile (id, name, rolle)
select id, 'Daniel Zimmermann', 'admin'
from auth.users where email = 'daniel.zimmermann@example.de';
```

### Passwort vergessen

Zugänge können sich selbst helfen: Auf der Anmeldeseite führt **Passwort
vergessen?** zu einem Formular, das einen Einmal-Link per E-Mail verschickt.
Der Link gilt eine Stunde und lässt sich nur einmal verwenden; nach der
Änderung werden alle bestehenden Anmeldungen beendet.

**Voraussetzung ist ein hinterlegter SMTP-Zugang** (Backoffice → Einstellungen).
Ohne ihn wird zwar ein Link erzeugt, aber nicht zugestellt — und die Seite
meldet aus Sicherheitsgründen trotzdem Erfolg. Kommt keine E-Mail an, lohnt
zuerst ein Blick auf die SMTP-Einstellungen und den Spam-Ordner.

Ein Administrator kann denselben Link auch selbst auslösen: Backoffice →
**Benutzer** → **Passwort-Link senden**. Er sieht das Passwort dabei nie.
Notfalls geht es auch direkt in Supabase: **Authentication → Users → ⋯ →
Reset password**.

## 4. Bereitstellen

Auf Vercel. Die Region ist in `vercel.json` auf `fra1` (Frankfurt) festgelegt,
das Supabase-Projekt liegt in `eu-west-1` (Irland) — beides innerhalb der EU.

`vercel.json` richtet außerdem den täglichen Lauf um 8 Uhr ein, der
Erinnerungsmails verschickt und Entwürfe älter als 30 Tage löscht.

## 5. Erste Schritte nach der Bereitstellung

1. Als Administrator anmelden und **Backoffice → Einstellungen** öffnen.
2. Die als Platzhalter gekennzeichneten Werte ersetzen: IK-Nummer,
   SEPA-Gläubiger-Identifikationsnummer, Adresse des Impressums.
3. SMTP-Zugang eintragen und über **Verbindung testen** prüfen.
4. Eine Testbestellung durchlaufen und das erzeugte PDF gegenlesen.

## 6. Preise ändern

Die Preise stehen in `src/lib/katalog.ts`. Sie liegen bewusst im Code und nicht
in der Datenbank, weil an ihnen Buchbarkeitsregeln hängen (welche Zusatzleistung
zu welchem Paket passt, welches Paket eine Kostenübernahme voraussetzt) und weil
jede Änderung nachvollziehbar in der Versionsgeschichte stehen soll.

Nach einer Änderung:

```bash
npm run pdf:test        # Preistabelle auf Seite 2 und 27 prüfen
npm run build
```

Bereits abgeschlossene Verträge bleiben unberührt: die Preisauskunft wird beim
Abschluss mitgespeichert.

## 7. Neue Vertragsfassung einspielen

1. Neues PDF nach `assets/vertrag/brk-hausnotruf-servicevertrag-2026.pdf` legen
   (Dateiname beibehalten oder in `tools/prepare_template.py` anpassen).
2. `python3 tools/analyze_pdf_fields.py` laufen lassen und `tools/out/report.txt`
   mit der Zuordnung in `src/lib/pdf/felder.ts` abgleichen.
3. `python3 tools/prepare_template.py` erzeugt Vorlage und Signaturpositionen neu.
4. `npm run pdf:test` und das Ergebnis Seite für Seite prüfen.
5. Ändern sich AGB oder Widerrufsbelehrung, müssen `src/lib/rechtstexte.ts` und
   `src/app/widerruf/page.tsx` nachgezogen werden.

## 8. Verträge nachbearbeiten

Backoffice und Admin können einen abgeschlossenen Vertrag über
**Vertrag → Bearbeiten** ergänzen oder berichtigen, etwa um die Vertragsnummer
nachzutragen oder eine falsch geschriebene Anschrift zu korrigieren.

Beim Speichern wird das Vertrags-PDF neu erzeugt. Dabei gilt:

- Die vom Kunden **unterschriebene Erstfassung bleibt unverändert erhalten** und
  ist über „Unterschriebene Erstfassung ansehen" jederzeit abrufbar. Ohne sie
  ließe sich später nicht mehr belegen, worauf sich die Unterschrift bezog.
- Jede Änderung wird mit Zeitpunkt, Bearbeiter und geänderten Feldern
  protokolliert und auf der Vertragsseite angezeigt.
- Auf Wunsch erhält der Kunde die neue Fassung per E-Mail, mit Angabe der
  geänderten Felder.

**Nicht bearbeitbar sind Paket, Zusatzleistungen und Beitrag.** Der Kunde hat
einen bestimmten Leistungsumfang zu einem bestimmten Preis unterschrieben; eine
Änderung daran wäre ein neuer Vertrag und keine Korrektur. Für solche Fälle ist
der bestehende Vertrag zu kündigen und ein neuer abzuschließen.

## 9. Fremde Tabellen im selben Supabase-Projekt

Im Projekt `qbkjpfpxpoydtlasbbuz` liegen neben den Hausnotruf-Tabellen noch
Tabellen einer anderen Anwendung: `admin_users`, `groups`, `links`, `icons`,
`scans`, `settings`, `vehicles`, `treffpunkte`, `link_placements` und
`group_link_order`.

**Diese Tabellen sind mit dem öffentlichen anon-Schlüssel lesbar.** Der
Sicherheitsbericht von Supabase (Advisors) meldet sie als „Public Can See
Object in GraphQL Schema“. Für die Hausnotruf-Daten besteht dadurch keine
Gefahr — deren Tabellen sind gesperrt und nur über den Server erreichbar.

Ich habe daran **nichts geändert**, weil die Tabellen zu einer anderen
Anwendung gehören und ein Entzug der Rechte diese lahmlegen könnte. Bitte mit
den Verantwortlichen dieser Anwendung klären. Wenn die Daten nicht öffentlich
sein sollen, lautet der Eingriff je Tabelle:

```sql
revoke select on public.<tabelle> from anon, authenticated;
```

Zu prüfen ist besonders `admin_users` — der Name legt nahe, dass dort
Zugangsdaten oder Rollen liegen.

## 10. Wiederkehrende Aufgaben

| Aufgabe | Wie oft | Wer |
|---|---|---|
| Trichteransicht durchsehen, Absprungpunkte prüfen | monatlich | Backoffice |
| Preisliste gegen die Excel-Vorlage abgleichen | bei jeder Preisänderung | Backoffice |
| Sicherheitsbericht in Supabase (Advisors) durchsehen | vierteljährlich | Administrator |
| Abhängigkeiten aktualisieren (`npm audit`) | vierteljährlich | Administrator |
| Verträge nach Ablauf der Aufbewahrungsfrist löschen | jährlich | Administrator, derzeit von Hand |
| Wiederherstellung aus der Sicherung testen | jährlich | Administrator |
