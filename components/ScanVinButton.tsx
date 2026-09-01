"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { vinOk } from "@/lib/format";

export const VIN_PAIR_BTN =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-amber px-2 text-center text-sm font-extrabold uppercase tracking-widest text-amber disabled:opacity-50";

export function extractVin(raw: string): string | null {
  const compact = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, "");
  if (vinOk(compact)) return compact;
  const m = compact.match(/[A-HJ-NPR-Z0-9]{17}/);
  return m && vinOk(m[0]) ? m[0] : null;
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
      const det = new Detector({ formats: ["code_39", "code_128", "code_93", "codabar", "qr_code"] });
      const hits = await det.detect(bmp);
      for (const h of hits) {
        const v = extractVin(String(h.rawValue ?? ""));
        if (v) return v;
      }
    }
  } catch {
    /* OCR */
  }
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return extractVin(String(data.text ?? ""));
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

  function lock(vin: string) {
    if (locked.current) return;
    locked.current = true;
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s?.isScanning) {
      void s.stop().catch(() => undefined).then(() => s.clear());
    }
    onVin(vin);
    onClose();
  }

  useEffect(() => {
    if (denied) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(readerId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.ITF,
      ],
    });
    scannerRef.current = scanner;

    const start = scanner
      .start(
        { facingMode: "environment" },
        { fps: 12 },
        (text) => {
          const v = extractVin(text);
          if (v) lock(v);
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

    let ocrTick = 0;
    const ocrStart = window.setTimeout(() => {
      ocrTick = window.setInterval(async () => {
      if (locked.current || cancelled) return;
      const video = document.querySelector(`#${readerId} video`) as HTMLVideoElement | null;
      if (!video || video.readyState < 2) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const { data } = await worker.recognize(canvas);
        await worker.terminate();
        const v = extractVin(String(data.text ?? ""));
        if (v) lock(v);
      } catch {
        /* keep scanning barcodes */
      }
      }, 2500);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(ocrStart);
      window.clearInterval(ocrTick);
      void start.finally(async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
        } catch {
          /* already stopped */
        }
      });
    };
    // readerId is stable for this mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied, readerId]);

  async function onPhoto(file: File) {
    setPhotoBusy(true);
    setHint(null);
    const vin = await readVinFromFile(file);
    setPhotoBusy(false);
    if (vin) lock(vin);
    else setHint("Couldn’t read a VIN. Type the 17 characters.");
  }

  const ui = (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <p className="text-center text-sm font-bold text-white">
        Point at the VIN barcode on the driver’s door sticker.
      </p>
      <div className="mt-3 min-h-52 flex-1 overflow-hidden rounded-xl bg-black">
        {!denied ? <div id={readerId} className="h-full w-full" /> : null}
        {denied ? (
          <div className="flex h-full min-h-52 items-center justify-center px-4 text-center text-white">
            Camera is off. Take a photo or type the VIN.
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-center text-sm font-bold text-amber">{hint}</p> : null}
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
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={VIN_PAIR_BTN}
          onClick={() => fileRef.current?.click()}
          disabled={photoBusy}
        >
          {photoBusy ? "Reading…" : "Take photo"}
        </button>
        <button type="button" className={`${VIN_PAIR_BTN} border-line text-white`} onClick={onClose}>
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
      {open ? (
        <ScanVinOverlay
          onVin={onVin}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
