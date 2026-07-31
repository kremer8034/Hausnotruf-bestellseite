#!/usr/bin/env python3
"""Bereitet das Original-PDF fuer die automatische Befuellung auf.

Drei Eingriffe, alle rein strukturell - das sichtbare Layout bleibt identisch:

1. Feldnamen entzerren. Drei Felder tragen im Original denselben Namen,
   meinen aber Unterschiedliches (z. B. ist "Datum_Inbetriebnahme" auf
   Seite 17 das Beratungsdatum und auf Seite 19 das Inbetriebnahmedatum).
   Ohne Trennung wuerde ein Wert beide Stellen fuellen.

2. Signaturfelder entfernen. Es sind /Sig-Felder fuer Zertifikatssignaturen;
   ein gezeichnetes Unterschriftsbild laesst sich dort nicht eintragen. Wir
   merken uns die Positionen und stempeln das Bild spaeter an genau diese
   Stelle.

3. NeedAppearances setzen, damit auch Viewer ohne eigene Appearance-Erzeugung
   die Werte anzeigen.

Ergebnis: assets/vertrag/vertrag-vorlage.pdf + assets/vertrag/signaturfelder.json
"""

import json
import os

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, BooleanObject, DictionaryObject, NameObject, TextStringObject

BASE = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(BASE, "assets", "vertrag", "brk-hausnotruf-servicevertrag-2026.pdf")
DST = os.path.join(BASE, "assets", "vertrag", "vertrag-vorlage.pdf")
SIGS = os.path.join(BASE, "assets", "vertrag", "signaturfelder.json")

# Feld -> {Seitennummer: neuer Feldname}
SPLITS = {
    "Datum_Inbetriebnahme": {17: "Datum_Beratung"},
    "Ort_Datum": {19: "Ort_Datum_Inbetriebnahme", 20: "Ort_Datum_Empfang"},
    "Textfeld 5": {21: "Preisliste_Zeile5"},
}


def page_of(writer, annot_ref):
    for pno, page in enumerate(writer.pages, start=1):
        for ref in page.get("/Annots") or []:
            if ref.idnum == annot_ref.idnum:
                return pno
    return None


def split_fields(writer, acro):
    fields = acro["/Fields"]
    new_fields = []
    for field_ref in list(fields):
        field = field_ref.get_object()
        name = str(field.get("/T") or "")
        if name not in SPLITS:
            continue
        mapping = SPLITS[name]
        kids = field.get("/Kids")
        if not kids:
            continue
        keep = []
        moved = {}
        for kid_ref in list(kids):
            pno = page_of(writer, kid_ref)
            if pno in mapping:
                moved.setdefault(mapping[pno], []).append(kid_ref)
            else:
                keep.append(kid_ref)
        if not moved:
            continue
        field[NameObject("/Kids")] = ArrayObject(keep)
        for new_name, kid_refs in moved.items():
            new_field = DictionaryObject()
            new_field[NameObject("/T")] = TextStringObject(new_name)
            new_field[NameObject("/FT")] = field["/FT"]
            for opt in ("/Ff", "/DA", "/Q", "/MaxLen"):
                if opt in field:
                    new_field[NameObject(opt)] = field[opt]
            new_ref = writer._add_object(new_field)
            new_field[NameObject("/Kids")] = ArrayObject(kid_refs)
            for kid_ref in kid_refs:
                kid_ref.get_object()[NameObject("/Parent")] = new_ref
            new_fields.append(new_ref)
            print(f"  getrennt: {name} -> {new_name} ({len(kid_refs)} Widget/s)")
    for ref in new_fields:
        fields.append(ref)


def strip_signature_fields(writer, acro):
    """Entfernt /Sig-Felder und liefert deren Positionen zurueck."""
    positions = []
    sig_widget_ids = set()
    fields = acro["/Fields"]
    keep = []
    for field_ref in fields:
        field = field_ref.get_object()
        if str(field.get("/FT")) != "/Sig":
            keep.append(field_ref)
            continue
        name = str(field.get("/T") or "")
        widgets = field.get("/Kids") or [field_ref]
        for w_ref in widgets:
            sig_widget_ids.add(w_ref.idnum)
            w = w_ref.get_object()
            rect = [float(x) for x in w["/Rect"]]
            positions.append({
                "name": name,
                "page": page_of(writer, w_ref),
                "rect": rect,
            })
    acro[NameObject("/Fields")] = ArrayObject(keep)

    for page in writer.pages:
        annots = page.get("/Annots")
        if not annots:
            continue
        page[NameObject("/Annots")] = ArrayObject(
            [a for a in annots if a.idnum not in sig_widget_ids])
    return positions


def main():
    reader = PdfReader(SRC)
    writer = PdfWriter(clone_from=reader)
    acro = writer._root_object["/AcroForm"]

    print("Felder entzerren:")
    split_fields(writer, acro)

    print("Signaturfelder entfernen:")
    positions = strip_signature_fields(writer, acro)
    positions.sort(key=lambda p: (p["page"], -p["rect"][3]))
    for p in positions:
        print(f'  S{p["page"]:>2}  {p["name"]}')

    acro[NameObject("/NeedAppearances")] = BooleanObject(True)

    with open(DST, "wb") as fh:
        writer.write(fh)
    with open(SIGS, "w", encoding="utf-8") as fh:
        json.dump(positions, fh, ensure_ascii=False, indent=1)

    check = PdfReader(DST)
    print(f"\nVorlage geschrieben: {DST}")
    print(f"Felder jetzt: {len(check.get_fields())} (vorher {len(reader.get_fields())})")
    print(f"Signaturpositionen: {len(positions)} -> {SIGS}")


if __name__ == "__main__":
    main()
