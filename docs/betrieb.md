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

Das Schema liegt in `supabase/migrations/0001_grundschema.sql`. Einspielen
entweder über die Supabase-Oberfläche (SQL Editor) oder mit der CLI:

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

Vorgehen je Zugang:

1. In Supabase unter **Authentication → Users** einen Benutzer mit E-Mail und
   Passwort anlegen.
2. Im SQL Editor das Profil ergänzen — ohne diesen Schritt ist keine Anmeldung
   möglich, selbst mit richtigem Passwort:

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

Notfalls setzt ein Administrator das Passwort direkt in Supabase zurück:
**Authentication → Users → ⋯ → Reset password**.

Einen Zugang sperren, ohne ihn zu löschen:

```sql
update profile set aktiv = false where id = '<benutzer-id>';
```

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

## 9. Wiederkehrende Aufgaben

| Aufgabe | Wie oft | Wer |
|---|---|---|
| Trichteransicht durchsehen, Absprungpunkte prüfen | monatlich | Backoffice |
| Preisliste gegen die Excel-Vorlage abgleichen | bei jeder Preisänderung | Backoffice |
| Verträge nach Ablauf der Aufbewahrungsfrist löschen | jährlich | Administrator, derzeit von Hand |
| Wiederherstellung aus der Sicherung testen | jährlich | Administrator |
