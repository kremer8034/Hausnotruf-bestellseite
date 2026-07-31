#!/usr/bin/env python3
"""Analysiert das AcroForm des BRK-Servicevertrags.

Erzeugt zwei Ausgaben:
  * tools/out/widgets.json  - alle Widgets mit Seite, Rechteck, Typ, Zustaenden
  * tools/out/report.txt    - lesbarer Bericht mit vermutetem Label je Widget

Die Label-Vermutung ist noetig, weil ein Teil der Felder im Original
irrefuehrend benannt ist (z. B. heissen die Gesundheitsdaten-Checkboxen
auf Seite 22 "Leistung_HNR 2" ff.).
"""

import json
import os
import sys

import pdfplumber
import pypdf

PDF = os.path.join(os.path.dirname(__file__), "..", "assets", "vertrag",
                   "brk-hausnotruf-servicevertrag-2026.pdf")
OUT = os.path.join(os.path.dirname(__file__), "out")


def widget_states(annot):
    """Liefert die moeglichen /AP /N Zustaende eines Button-Widgets."""
    try:
        ap = annot.get("/AP")
        if not ap:
            return []
        n = ap.get("/N")
        if not n or not hasattr(n, "keys"):
            return []
        return [str(k) for k in n.keys()]
    except Exception:
        return []


def inherited(annot, key):
    if key in annot:
        return annot[key]
    parent = annot.get("/Parent")
    if parent is not None:
        return inherited(parent.get_object(), key)
    return None


def collect_widgets(reader):
    widgets = []
    for pno, page in enumerate(reader.pages, start=1):
        for ref in page.get("/Annots") or []:
            a = ref.get_object()
            if a.get("/Subtype") != "/Widget":
                continue
            name = inherited(a, "/T")
            ft = inherited(a, "/FT")
            if name is None:
                continue
            rect = [float(x) for x in a["/Rect"]]
            widgets.append({
                "page": pno,
                "name": str(name),
                "type": str(ft),
                "rect": rect,
                "states": widget_states(a) if str(ft) == "/Btn" else [],
                "flags": int(inherited(a, "/Ff") or 0),
            })
    return widgets


def guess_label(words, rect, page_height, kind):
    """Sucht den Text, der am ehesten zu einem Widget gehoert.

    pdfplumber rechnet von oben, PDF-Rechtecke von unten - daher umrechnen.
    Checkboxen tragen ihr Label rechts daneben, Textfelder darueber.
    """
    x0, y0, x1, y1 = rect
    top = page_height - y1
    bottom = page_height - y0
    cy = (top + bottom) / 2

    if kind == "/Btn":
        band = [w for w in words
                if w["x0"] >= x1 - 2 and w["x0"] < x1 + 220
                and w["top"] < cy + 9 and w["bottom"] > cy - 9]
        band.sort(key=lambda w: w["x0"])
        return " ".join(w["text"] for w in band[:14])

    # Textfeld: Beschriftung steht im Original ueber dem Feld
    band = [w for w in words
            if w["bottom"] <= top + 3 and w["bottom"] > top - 22
            and w["x1"] > x0 - 12 and w["x0"] < x1 + 12]
    band.sort(key=lambda w: (round(w["top"]), w["x0"]))
    label = " ".join(w["text"] for w in band[:12])
    if label.strip():
        return label
    # sonst: Text links daneben
    band = [w for w in words
            if w["x1"] <= x0 + 2 and w["x1"] > x0 - 260
            and w["top"] < cy + 8 and w["bottom"] > cy - 8]
    band.sort(key=lambda w: w["x0"])
    return " ".join(w["text"] for w in band[-14:])


def main():
    os.makedirs(OUT, exist_ok=True)
    reader = pypdf.PdfReader(PDF)
    widgets = collect_widgets(reader)

    with pdfplumber.open(PDF) as pdf:
        for w in widgets:
            page = pdf.pages[w["page"] - 1]
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
            w["label"] = guess_label(words, w["rect"], page.height, w["type"])

    with open(os.path.join(OUT, "widgets.json"), "w", encoding="utf-8") as fh:
        json.dump(widgets, fh, ensure_ascii=False, indent=1)

    lines = []
    for pno in sorted({w["page"] for w in widgets}):
        lines.append(f"\n===== SEITE {pno} =====")
        page_widgets = [w for w in widgets if w["page"] == pno]
        # nach Leserichtung sortieren: oben nach unten, links nach rechts
        page_widgets.sort(key=lambda w: (-w["rect"][3], w["rect"][0]))
        for w in page_widgets:
            st = ",".join(w["states"]) if w["states"] else ""
            lines.append(
                f'{w["name"]:<38} {w["type"]:<5} {st:<22} '
                f'x={w["rect"][0]:6.1f} y={w["rect"][1]:6.1f}  {w["label"][:80]}')
    report = "\n".join(lines)
    with open(os.path.join(OUT, "report.txt"), "w", encoding="utf-8") as fh:
        fh.write(report)

    print(f"{len(widgets)} Widgets analysiert -> {OUT}")
    if len(sys.argv) > 1:
        wanted = {int(x) for x in sys.argv[1:]}
        for pno in sorted(wanted):
            print("\n".join(l for l in lines if True) if False else "", end="")
        for block in report.split("\n===== ")[1:]:
            head = block.split(" ", 2)[1]
            if int(head) in wanted:
                print("===== " + block)


if __name__ == "__main__":
    main()
