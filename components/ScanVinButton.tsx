"use client";

import { useRef, useState } from "react";
import { vinOk } from "@/lib/format";

export const VIN_PAIR_BTN =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-amber px-2 text-center text-sm font-extrabold uppercase tracking-widest text-amber disabled:opacity-50";

async function readVinFromFile(file: File): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (Detector) {
      const det = new Detector({ formats: ["code_39", "code_128", "code_93", "codabar", "qr_code"] });
      const hits = await det.detect(bmp);
      for (const h of hits) {
        const raw = String(h.rawValue ?? "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
        if (vinOk(raw)) return raw;
      }
    }
  } catch {
    /* fall through to OCR */
  }
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const blob = String(data.text ?? "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, " ");
    const m = blob.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    return m && vinOk(m[0]) ? m[0] : null;
  } catch {
    return null;
  }
}

export function ScanVinButton({
  onVin,
}: {
  onVin: (vin: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="contents">
      <input
        ref={ref}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setErr(null);
          const vin = await readVinFromFile(file);
          setBusy(false);
          if (vin) onVin(vin);
          else setErr("Couldn’t read a VIN. Type the 17 characters.");
        }}
      />
      <button
        type="button"
        className={VIN_PAIR_BTN}
        onClick={() => ref.current?.click()}
        disabled={busy}
      >
        {busy ? "Reading…" : "Scan VIN"}
      </button>
      {err ? <p className="col-span-2 text-sm text-red">{err}</p> : null}
    </div>
  );
}
