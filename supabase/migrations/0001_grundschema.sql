-- Grundschema der Hausnotruf-Bestellseite.
--
-- Zugriff erfolgt ausschließlich serverseitig über den Service-Role-Schlüssel.
-- Für alle Tabellen ist RLS aktiv und es gibt bewusst keine Policy: damit kann
-- der öffentliche anon-Schlüssel nichts lesen, selbst wenn er bekannt würde.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- Konfiguration

create table if not exists konfiguration (
  schluessel   text primary key,
  wert         jsonb not null,
  geaendert_am timestamptz not null default now()
);

comment on table konfiguration is
  'Stammdaten des Kreisverbands und SMTP-Zugang. Ein Datensatz je Bereich.';

-- ---------------------------------------------------------------- Entwürfe

create table if not exists entwuerfe (
  id                  uuid primary key default gen_random_uuid(),
  -- Zufälliges Geheimnis für den "Später weitermachen"-Link.
  token               text not null unique,
  daten               jsonb not null default '{}'::jsonb,
  schritt             text not null default 'start',
  email               text,
  -- Anonymer Sitzungsschlüssel für die Trichteransicht.
  sitzung_id          text,
  erinnerung_am       timestamptz,
  abgeschlossen       boolean not null default false,
  erstellt_am         timestamptz not null default now(),
  aktualisiert_am     timestamptz not null default now()
);

create index if not exists entwuerfe_offen_idx
  on entwuerfe (aktualisiert_am) where not abgeschlossen;
create index if not exists entwuerfe_sitzung_idx on entwuerfe (sitzung_id);

comment on table entwuerfe is
  'Nicht abgeschlossene Bestellungen. Werden nach 30 Tagen gelöscht.';

-- ---------------------------------------------------------------- Verträge

create type vertrags_status as enum (
  'neu', 'kasse_beantragt', 'kasse_genehmigt', 'installiert', 'gekuendigt'
);

create table if not exists vertraege (
  id                  uuid primary key default gen_random_uuid(),
  vorgangsnummer      text not null unique,
  status              vertrags_status not null default 'neu',
  -- Vollständige Bestelldaten (Struktur: src/lib/typen.ts, Bestellung).
  daten               jsonb not null,
  -- Berechnete Preisauskunft zum Zeitpunkt des Abschlusses.
  preis               jsonb not null,
  paket               text not null,
  kostenuebernahme    boolean not null default false,
  -- Nachweis der Unterschrift.
  unterschrift        text not null,
  unterschrift_ip     inet,
  unterschrift_zeit   timestamptz not null default now(),
  -- Ablage des erzeugten PDF im Storage-Bucket "vertraege".
  pdf_pfad            text,
  -- Vom Techniker vor Ort ergänzte Angaben (Struktur: VorOrtErfassung).
  vor_ort             jsonb,
  vor_ort_von         uuid references auth.users (id),
  vor_ort_am          timestamptz,
  gesamt_pdf_pfad     text,
  notiz               text,
  erstellt_am         timestamptz not null default now(),
  aktualisiert_am     timestamptz not null default now()
);

create index if not exists vertraege_status_idx on vertraege (status);
create index if not exists vertraege_erstellt_idx on vertraege (erstellt_am desc);

comment on column vertraege.unterschrift_ip is
  'Teil des Nachweises der einfachen elektronischen Signatur.';

-- ---------------------------------------------------------------- Trichter

create table if not exists ereignisse (
  id           bigserial primary key,
  sitzung_id   text not null,
  entwurf_id   uuid references entwuerfe (id) on delete set null,
  schritt      text not null,
  art          text not null,           -- 'angesehen' | 'abgeschlossen' | 'abgebrochen'
  geraet       text,                    -- 'handy' | 'tablet' | 'rechner'
  quelle       text,                    -- Referrer-Host, ohne Parameter
  zeit         timestamptz not null default now()
);

create index if not exists ereignisse_schritt_idx on ereignisse (schritt, art);
create index if not exists ereignisse_zeit_idx on ereignisse (zeit desc);
create index if not exists ereignisse_sitzung_idx on ereignisse (sitzung_id);

comment on table ereignisse is
  'Anonyme Schrittereignisse für die Trichteransicht. Keine IP, kein Cookie Dritter.';

-- ---------------------------------------------------------------- Benutzer

create type benutzer_rolle as enum ('admin', 'mitarbeiter', 'techniker');

create table if not exists profile (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  rolle      benutzer_rolle not null default 'mitarbeiter',
  aktiv      boolean not null default true,
  erstellt_am timestamptz not null default now()
);

comment on table profile is
  'Rollen der Backoffice- und Technikerzugänge. admin darf Einstellungen ändern.';

-- ---------------------------------------------------------------- Automatik

create or replace function setze_aktualisiert_am()
returns trigger language plpgsql as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

drop trigger if exists entwuerfe_aktualisiert on entwuerfe;
create trigger entwuerfe_aktualisiert before update on entwuerfe
  for each row execute function setze_aktualisiert_am();

drop trigger if exists vertraege_aktualisiert on vertraege;
create trigger vertraege_aktualisiert before update on vertraege
  for each row execute function setze_aktualisiert_am();

-- Fortlaufende Vorgangsnummer je Jahr, z. B. HNR-2026-0001.
create sequence if not exists vorgangsnummer_seq;

create or replace function naechste_vorgangsnummer()
returns text language plpgsql as $$
declare
  n bigint;
begin
  n := nextval('vorgangsnummer_seq');
  return 'HNR-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------- Zugriffsschutz

alter table konfiguration enable row level security;
alter table entwuerfe     enable row level security;
alter table vertraege     enable row level security;
alter table ereignisse    enable row level security;
alter table profile       enable row level security;

-- Bewusst keine Policies: Zugriff nur über den Service-Role-Schlüssel,
-- der ausschließlich serverseitig verwendet wird.
