"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Unterschriftenfeld auf Canvas-Basis.
 *
 * Liefert ein PNG mit transparentem Hintergrund, das später an der Position
 * des ursprünglichen Signaturfelds in den Vertrag gestempelt wird. Der Strich
 * wird geglättet (quadratische Bézier durch die Mittelpunkte), sonst wirken
 * Mausunterschriften eckig.
 */
export function Unterschriftenfeld({
  onAendern,
  hinweis = "Bitte mit dem Finger oder der Maus unterschreiben.",
}: {
  onAendern: (dataUrl: string | null) => void;
  hinweis?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const letzter = useRef<{ x: number; y: number } | null>(null);
  const vorletzter = useRef<{ x: number; y: number } | null>(null);
  const [leer, setLeer] = useState(true);

  const richteEin = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const breite = canvas.clientWidth;
    const hoehe = canvas.clientHeight;
    // Nur neu dimensionieren, wenn nötig – sonst löscht es die Unterschrift.
    if (canvas.width === breite * dpr && canvas.height === hoehe * dpr) return;
    canvas.width = breite * dpr;
    canvas.height = hoehe * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  useEffect(() => {
    richteEin();
    window.addEventListener("resize", richteEin);
    return () => window.removeEventListener("resize", richteEin);
  }, [richteEin]);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const p = position(e);
    letzter.current = p;
    vorletzter.current = p;
    // Ein einzelner Tipp soll einen Punkt hinterlassen.
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
    }
  }

  function bewegen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !letzter.current || !vorletzter.current) return;
    const p = position(e);
    const mitteAlt = {
      x: (vorletzter.current.x + letzter.current.x) / 2,
      y: (vorletzter.current.y + letzter.current.y) / 2,
    };
    const mitteNeu = { x: (letzter.current.x + p.x) / 2, y: (letzter.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(mitteAlt.x, mitteAlt.y);
    ctx.quadraticCurveTo(letzter.current.x, letzter.current.y, mitteNeu.x, mitteNeu.y);
    ctx.stroke();
    vorletzter.current = letzter.current;
    letzter.current = p;
    if (leer) setLeer(false);
  }

  function beenden() {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    letzter.current = null;
    vorletzter.current = null;
    const canvas = canvasRef.current;
    if (canvas && !istLeer(canvas)) {
      onAendern(zuschneiden(canvas));
      setLeer(false);
    }
  }

  function loeschen() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setLeer(true);
    onAendern(null);
  }

  return (
    <div>
      <div
        className={`unterschrift-flaeche relative rounded-lg border-2 border-dashed bg-white transition ${
          leer ? "border-tinte-300" : "border-brk-300"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="h-40 w-full cursor-crosshair touch-none sm:h-48"
          onPointerDown={start}
          onPointerMove={bewegen}
          onPointerUp={beenden}
          onPointerLeave={beenden}
          onPointerCancel={beenden}
          aria-label="Unterschriftenfeld"
        />
        {leer && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-tinte-400">
            Hier unterschreiben
          </p>
        )}
        <div className="pointer-events-none absolute right-4 bottom-6 left-4 border-b border-tinte-300" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-tinte-500">{hinweis}</p>
        <button
          type="button"
          onClick={loeschen}
          disabled={leer}
          className="shrink-0 text-xs font-medium text-tinte-600 underline underline-offset-2 hover:text-brk-700 disabled:opacity-40"
        >
          Neu unterschreiben
        </button>
      </div>
    </div>
  );
}

function istLeer(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const daten = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < daten.length; i += 4) {
    if (daten[i] !== 0) return false;
  }
  return true;
}

/**
 * Schneidet den leeren Rand ab, damit die Unterschrift das Feld im PDF
 * ausfüllt und nicht als kleiner Strich in der Mitte landet.
 */
function zuschneiden(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const daten = ctx.getImageData(0, 0, width, height).data;

  let oben = height;
  let unten = 0;
  let links = width;
  let rechts = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (daten[(y * width + x) * 4 + 3] !== 0) {
        if (y < oben) oben = y;
        if (y > unten) unten = y;
        if (x < links) links = x;
        if (x > rechts) rechts = x;
      }
    }
  }
  if (unten < oben || rechts < links) return canvas.toDataURL("image/png");

  const rand = 6;
  links = Math.max(0, links - rand);
  oben = Math.max(0, oben - rand);
  rechts = Math.min(width - 1, rechts + rand);
  unten = Math.min(height - 1, unten + rand);

  const ziel = document.createElement("canvas");
  ziel.width = rechts - links + 1;
  ziel.height = unten - oben + 1;
  ziel
    .getContext("2d")
    ?.drawImage(canvas, links, oben, ziel.width, ziel.height, 0, 0, ziel.width, ziel.height);
  return ziel.toDataURL("image/png");
}
