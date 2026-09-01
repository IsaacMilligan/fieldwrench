"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { vinCheckDigitOk } from "@/lib/format";

export const VIN_PAIR_BTN =
  "flex h-12 w-full items-center justify-center rounded-lg border-2 border-amber px-2 text-center text-sm font-extrabold uppercase tracking-widest text-amber disabled:opacity-50";

const CTRL =
  "relative z-[1] flex min-h-12 w-full items-center justify-center rounded-lg border-2 px-3 text-center text-sm font-extrabold uppercase tracking-widest disabled:opacity-40";

const NOT_VIN = "Not the VIN code.";
const LOOKING = "Looking for VIN barcode…";
const TESLA_WMI = ["5YJ", "7SA", "LRW"];

type ReaderOptions = {
  tryHarder: boolean;
  tryRotate: boolean;
  tryInvert: boolean;
  tryDownscale: boolean;
  tryDenoise?: boolean;
  formats: string[];
  maxNumberOfSymbols: number;
};

const LIVE_OPTS: ReaderOptions = {
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  formats: ["Code39", "Code128", "PDF417", "QRCode", "DataMatrix"],
  maxNumberOfSymbols: 8,
};

const PHOTO_OPTS: ReaderOptions = { ...LIVE_OPTS, tryDenoise: true };

type ZxingReader = {
  prepareZXingModule: (opts: {
    overrides: { locateFile: (path: string, prefix: string) => string };
    fireImmediately: true;
  }) => Promise<unknown>;
  readBarcodes: (
    input: Blob | ImageData,
    opts?: ReaderOptions,
  ) => Promise<{ text?: string; error?: string }[]>;
};

let zxingReady: Promise<ZxingReader> | null = null;

function loadZxing(): Promise<ZxingReader> {
  if (!zxingReady) {
    zxingReady = import("zxing-wasm/reader").then(async (mod) => {
      await mod.prepareZXingModule({
        overrides: {
          locateFile: (path, prefix) =>
            path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path,
        },
        fireImmediately: true,
      });
      return mod as unknown as ZxingReader;
    });
  }
  return zxingReady;
}

function pickVin(hits: string[]): string | null {
  if (!hits.length) return null;
  const tesla = hits.find((v) => TESLA_WMI.some((p) => v.startsWith(p)));
  return tesla ?? hits[0];
}

function findVinWindow(s: string): string | null {
  const chars = s.replace(/[^A-HJ-NPR-Z0-9]/g, "");
  const hits: string[] = [];
  for (let i = 0; i + 17 <= chars.length; i++) {
    const slice = chars.slice(i, i + 17);
    if (vinCheckDigitOk(slice)) hits.push(slice);
  }
  return pickVin(hits);
}

/** VIN from a barcode payload: exact 17, leading I, or 17-char VIN inside a longer string. Check digit required. */
export function vinFromBarcodePayload(raw: string): string | null {
  const upper = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.:/=]/g, "");
  if (!upper) return null;
  if (vinCheckDigitOk(upper)) return upper;
  const tokens = String(raw ?? "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const tokenHits: string[] = [];
  for (const part of tokens) {
    if (vinCheckDigitOk(part)) tokenHits.push(part);
    if (part.startsWith("I") && vinCheckDigitOk(part.slice(1, 18))) tokenHits.push(part.slice(1, 18));
  }
  const fromTokens = pickVin(tokenHits);
  if (fromTokens) return fromTokens;
  if (upper.startsWith("I")) {
    const rest = upper.slice(1);
    if (vinCheckDigitOk(rest.slice(0, 17))) return rest.slice(0, 17);
    const inner = findVinWindow(rest);
    if (inner) return inner;
  }
  return findVinWindow(upper);
}

function rotate90(src: ImageData): ImageData {
  const w = src.width;
  const h = src.height;
  const dst = new ImageData(h, w);
  const s = src.data;
  const d = dst.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const dx = h - 1 - y;
      const dy = x;
      const di = (dy * h + dx) * 4;
      d[di] = s[si];
      d[di + 1] = s[si + 1];
      d[di + 2] = s[si + 2];
      d[di + 3] = s[si + 3];
    }
  }
  return dst;
}

function grabFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  mode: "full" | "square" | "rot90",
): ImageData | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  if (mode === "square") {
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    const out = Math.min(720, side);
    canvas.width = out;
    canvas.height = out;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out);
    return ctx.getImageData(0, 0, out, out);
  }

  const scale = Math.min(1, 1280 / Math.max(vw, vh));
  const dw = Math.max(1, Math.round(vw * scale));
  const dh = Math.max(1, Math.round(vh * scale));
  canvas.width = dw;
  canvas.height = dh;
  ctx.drawImage(video, 0, 0, dw, dh);
  const full = ctx.getImageData(0, 0, dw, dh);
  return mode === "rot90" ? rotate90(full) : full;
}

async function decodeImageData(image: ImageData, opts: ReaderOptions): Promise<string[]> {
  const zx = await loadZxing();
  const results = await zx.readBarcodes(image, opts);
  return results.map((r) => String(r.text ?? "")).filter((t) => t.length > 0);
}

async function decodeBlob(blob: Blob, opts: ReaderOptions): Promise<string[]> {
  const zx = await loadZxing();
  const results = await zx.readBarcodes(blob, opts);
  return results.map((r) => String(r.text ?? "")).filter((t) => t.length > 0);
}

function vinFromTexts(texts: string[]): { vin: string | null; sawCode: boolean } {
  let sawCode = false;
  for (const text of texts) {
    if (!text) continue;
    sawCode = true;
    const vin = vinFromBarcodePayload(text);
    if (vin) return { vin, sawCode: true };
  }
  return { vin: null, sawCode };
}

export async function readVinFromFile(file: File): Promise<string | null> {
  try {
    const texts = await decodeBlob(file, PHOTO_OPTS);
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (bitmap) {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const extra = await decodeImageData(rotate90(img), PHOTO_OPTS);
        texts.push(...extra);
      }
      bitmap.close();
    }
    return vinFromTexts(texts).vin;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const locked = useRef(false);
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState(LOOKING);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const el = videoRef.current;
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
    setStatus(LOOKING);
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
    video.autoplay = true;

    const start = (async () => {
      await loadZxing();
      if (cancelled) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* autoplay with muted + playsInline */
      }
      const track = stream.getVideoTracks()[0];
      try {
        void track.applyConstraints({
          // @ts-expect-error iOS focusMode
          advanced: [{ focusMode: "continuous" }],
        });
      } catch {
        /* autofocus not available */
      }

      const canvas = canvasRef.current ?? document.createElement("canvas");
      let tick = 0;
      let busy = false;

      const loop = async () => {
        if (cancelled || locked.current) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          try {
            const mode: "full" | "square" | "rot90" = tick % 3 === 0 ? "square" : tick % 3 === 1 ? "rot90" : "full";
            tick += 1;
            const frame = grabFrame(video, canvas, mode);
            if (frame) {
              const texts = await decodeImageData(frame, LIVE_OPTS);
              if (cancelled || locked.current) return;
              const { vin, sawCode } = vinFromTexts(texts);
              if (vin) propose(vin);
              else if (sawCode) setStatus(NOT_VIN);
            }
          } catch {
            /* keep hunting */
          } finally {
            busy = false;
          }
        }
        if (!cancelled && !locked.current) window.setTimeout(() => void loop(), 160);
      };
      void loop();
    })().catch((e: unknown) => {
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
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
          Point at the VIN barcode or the square Data Matrix on the driver’s door sticker.
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
        <canvas ref={canvasRef} className="hidden" />
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
