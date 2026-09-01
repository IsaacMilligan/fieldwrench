"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { vinCheckDigitOk } from "@/lib/format";

export const VIN_PAIR_BTN =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-amber px-2 text-center text-sm font-extrabold uppercase tracking-widest text-amber disabled:opacity-50";

const CTRL =
  "relative z-[1] flex min-h-12 w-full items-center justify-center rounded-lg border-2 px-3 text-center text-sm font-extrabold uppercase tracking-widest disabled:opacity-40";

const NOT_VIN = "That’s not the VIN barcode — use the VIN bar on the door sticker.";

function zxingHints() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_128,
    BarcodeFormat.PDF_417,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

function findVinWindow(s: string): string | null {
  const chars = s.replace(/[^A-HJ-NPR-Z0-9]/g, "");
  for (let i = 0; i + 17 <= chars.length; i++) {
    const slice = chars.slice(i, i + 17);
    if (vinCheckDigitOk(slice)) return slice;
  }
  return null;
}

/** VIN from a barcode payload: exact 17, leading I, or 17-char VIN inside a longer string. Check digit required. */
export function vinFromBarcodePayload(raw: string): string | null {
  const upper = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "");
  if (!upper) return null;
  if (vinCheckDigitOk(upper)) return upper;
  if (upper.startsWith("I")) {
    const rest = upper.slice(1);
    if (vinCheckDigitOk(rest.slice(0, 17))) return rest.slice(0, 17);
    const inner = findVinWindow(rest);
    if (inner) return inner;
  }
  return findVinWindow(upper);
}

export async function readVinFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader(zxingHints());
    const result = await reader.decodeFromImageUrl(url);
    return vinFromBarcodePayload(result.getText());
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ScanVinOverlay({
  onVin,
  onClose,
}: {
  onVin: (vin: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const locked = useRef(false);
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState("Looking for VIN barcode…");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);

  function stopCamera() {
    stopRef.current?.();
    stopRef.current = null;
    const el = videoRef.current;
    const stream = el?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (el) el.srcObject = null;
  }

  function cancel() {
    stopCamera();
    onClose();
  }

  function propose(vin: string) {
    if (!vinCheckDigitOk(vin)) return;
    if (locked.current) return;
    locked.current = true;
    stopCamera();
    setCandidate(vin);
    setStatus(`VIN: ${vin}`);
  }

  function scanAgain() {
    locked.current = false;
    setCandidate(null);
    setStatus("Looking for VIN barcode…");
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
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.playsInline = true;

    const reader = new BrowserMultiFormatReader(zxingHints());
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    const run = reader
      .decodeFromConstraints(constraints, video, (result) => {
        if (cancelled || locked.current || !result) return;
        const text = result.getText();
        const vin = vinFromBarcodePayload(text);
        if (vin) {
          propose(vin);
          return;
        }
        setStatus(NOT_VIN);
      })
      .then((controls) => {
        stopRef.current = () => controls.stop();
        const stream = video.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        try {
          void track?.applyConstraints({
            // @ts-expect-error iOS focusMode is not in every lib.dom
            advanced: [{ focusMode: "continuous" }],
          });
        } catch {
          /* autofocus not available */
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        const msg = e instanceof Error ? e.message : String(e);
        if (name === "NotAllowedError" || /permission|denied|notallowed/i.test(msg)) {
          setDenied(true);
          setStatus("Camera permission denied.");
        } else {
          setDenied(true);
          setStatus("Couldn’t open the camera. Use Take photo or type the VIN.");
        }
      });

    return () => {
      cancelled = true;
      void run.finally(() => {
        try {
          stopRef.current?.();
        } catch {
          /* already stopped */
        }
      });
      const stream = video.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied, candidate]);

  async function onPhoto(file: File) {
    setPhotoBusy(true);
    const vin = await readVinFromFile(file);
    setPhotoBusy(false);
    if (vin) propose(vin);
    else setStatus(NOT_VIN);
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

      <div className="relative z-0 mx-4 mt-3 min-h-[45dvh] flex-1 overflow-hidden rounded-xl bg-black">
        {valid ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="font-mono text-lg font-bold tracking-wide text-white">VIN: {candidate}</p>
          </div>
        ) : denied ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-white">
            Camera is off. Take a photo of the VIN barcode or type the VIN.
          </div>
        ) : (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            autoPlay
          />
        )}
      </div>

      <p className="relative z-[10000] px-4 pt-2 text-center text-sm font-bold text-amber" aria-live="polite">
        {status}
      </p>

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
          Use VIN
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
