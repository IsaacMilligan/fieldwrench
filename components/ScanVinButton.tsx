"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { vinCheckDigitOk } from "@/lib/format";

export const VIN_PAIR_BTN =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-amber px-2 text-center text-sm font-extrabold uppercase tracking-widest text-amber disabled:opacity-50";

const CTRL =
  "relative z-[1] flex min-h-12 w-full items-center justify-center rounded-lg border-2 px-3 text-center text-sm font-extrabold uppercase tracking-widest disabled:opacity-40";

/** Barcode payload must be exactly 17 chars (optional spaces/hyphens) with ISO check digit. */
export function vinFromBarcodePayload(raw: string): string | null {
  const trimmed = String(raw ?? "").trim().toUpperCase();
  if (vinCheckDigitOk(trimmed)) return trimmed;
  const compact = trimmed.replace(/[\s-]/g, "");
  if (compact.length === 17 && vinCheckDigitOk(compact)) return compact;
  return null;
}

export async function readVinFromFile(file: File): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => {
          detect: (s: ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;
    if (Detector) {
      const det = new Detector({ formats: ["code_39", "code_128", "qr_code"] });
      const hits = await det.detect(bmp);
      for (const h of hits) {
        const v = vinFromBarcodePayload(String(h.rawValue ?? ""));
        if (v) return v;
      }
    }
  } catch {
    /* still photo OCR only — never live overlay text */
  }
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const compact = String(data.text ?? "")
      .toUpperCase()
      .replace(/[\s-]/g, "");
    if (compact.length === 17 && vinCheckDigitOk(compact)) return compact;
    return vinFromBarcodePayload(compact);
  } catch {
    return null;
  }
}

function ScanVinOverlay({
  onVin,
  onClose,
}: {
  onVin: (vin: string) => void;
  onClose: () => void;
}) {
  const reactId = useId().replace(/:/g, "");
  const readerId = `vin-reader-${reactId}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const locked = useRef(false);
  const [denied, setDenied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);

  function stopScanner() {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s?.isScanning) {
      void s
        .stop()
        .catch(() => undefined)
        .then(() => s.clear());
    }
  }

  function propose(vin: string) {
    if (!vinCheckDigitOk(vin)) return;
    if (locked.current) return;
    locked.current = true;
    stopScanner();
    setCandidate(vin);
  }

  function cancel() {
    stopScanner();
    onClose();
  }

  function scanAgain() {
    locked.current = false;
    setCandidate(null);
    setHint(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (denied || candidate) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });
    scannerRef.current = scanner;

    const start = scanner
      .start(
        { facingMode: "environment" },
        { fps: 12 },
        (text) => {
          const v = vinFromBarcodePayload(text);
          if (v) propose(v);
        },
        () => undefined,
      )
      .catch((e: unknown) => {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        const msg = e instanceof Error ? e.message : String(e);
        if (name === "NotAllowedError" || /permission|denied|notallowed/i.test(msg)) {
          setDenied(true);
          setHint("Camera permission denied.");
        } else {
          setDenied(true);
          setHint("Couldn’t open the camera. Use Take photo or type the VIN.");
        }
      });

    return () => {
      cancelled = true;
      void start.finally(async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
        } catch {
          /* already stopped */
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied, readerId, candidate]);

  async function onPhoto(file: File) {
    setPhotoBusy(true);
    setHint(null);
    const vin = await readVinFromFile(file);
    setPhotoBusy(false);
    if (vin) propose(vin);
    else setHint("Couldn’t read a VIN. Type the 17 characters.");
  }

  const valid = candidate !== null && vinCheckDigitOk(candidate);

  const ui = (
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] flex-col bg-[#070806] pointer-events-auto">
      <header className="relative z-[10000] flex shrink-0 items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="flex-1 pt-2 text-sm font-bold leading-snug text-white">
          Use the VIN barcode on the driver’s door sticker, not the other labels.
        </p>
        <button
          type="button"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-amber text-2xl leading-none text-amber"
          aria-label="Cancel"
          onClick={cancel}
        >
          ×
        </button>
      </header>

      <div className="relative z-0 mx-4 mt-3 min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
        {candidate && valid ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="font-mono text-lg font-bold tracking-wide text-white">VIN: {candidate}</p>
          </div>
        ) : !denied ? (
          <div id={readerId} className="h-full w-full overflow-hidden" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-white">
            Camera is off. Take a photo or type the VIN.
          </div>
        )}
      </div>

      {hint ? <p className="relative z-[10000] px-4 pt-2 text-center text-sm font-bold text-amber">{hint}</p> : null}

      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPhoto(f);
        }}
      />

      <div className="relative z-[10000] mt-3 flex shrink-0 flex-col gap-2 bg-[#070806] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          className={`${CTRL} border-amber bg-amber text-[#120e04]`}
          disabled={!valid}
          onClick={() => {
            if (!valid || !candidate) return;
            onVin(candidate);
            cancel();
          }}
        >
          Use
        </button>
        <button
          type="button"
          className={`${CTRL} border-amber text-amber`}
          disabled={!candidate && !denied}
          onClick={() => {
            if (candidate) scanAgain();
            else fileRef.current?.click();
          }}
        >
          {photoBusy ? "Reading…" : candidate ? "Scan again" : "Take photo"}
        </button>
        <button type="button" className={`${CTRL} border-line text-white`} onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

export function ScanVinButton({
  onVin,
}: {
  onVin: (vin: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="contents">
      <button type="button" className={VIN_PAIR_BTN} onClick={() => setOpen(true)}>
        Scan VIN
      </button>
      {open ? <ScanVinOverlay onVin={onVin} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
