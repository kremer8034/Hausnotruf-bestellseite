-- Nachbearbeitung von Verträgen durch das Backoffice.
--
-- Die Vertragsnummer vergibt der Kreisverband selbst, meist erst nach Eingang.
-- Sie ist deshalb nicht Teil der Bestelldaten, sondern eine eigene Spalte.
--
-- Wichtig: Beim Nachbearbeiten wird das Vertrags-PDF neu erzeugt. Die Fassung,
-- die der Kunde tatsächlich unterschrieben hat, bleibt daneben unverändert
-- erhalten - sonst ließe sich später nicht mehr belegen, worauf sich die
-- Unterschrift bezog.

alter table vertraege
  add column if not exists vertragsnummer      text,
  add column if not exists pdf_original_pfad   text,
  add column if not exists aenderungsprotokoll jsonb not null default '[]'::jsonb;

comment on column vertraege.vertragsnummer is
  'Vom Kreisverband vergebene Vertragsnummer. Erscheint auf allen 27 Seiten.';
comment on column vertraege.pdf_original_pfad is
  'Die vom Kunden unterschriebene Erstfassung. Wird nie überschrieben.';
comment on column vertraege.aenderungsprotokoll is
  'Liste der Nachbearbeitungen: Zeitpunkt, Bearbeiter und geänderte Felder.';

create index if not exists vertraege_vertragsnummer_idx
  on vertraege (vertragsnummer) where vertragsnummer is not null;

-- Bestandsdaten: die bisherige Ablage ist zugleich die unterschriebene Fassung.
update vertraege
   set pdf_original_pfad = pdf_pfad
 where pdf_original_pfad is null
   and pdf_pfad is not null;
