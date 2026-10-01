"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

/** Fired after a successful import save so client oil hints (create-job) can refetch. */
export const OIL_SAVED_EVENT = "fw-oil-spec-saved";

const MAX_IMAGES = 6;
/** Keep the whole upload under the serverless request limit (~4.5 MB on Vercel). */
const MAX_TOTAL_BYTES = 4_200_000;
const SHRINK_OVER_BYTES = 650_000;

type Field<T> = { value: T; image: number } | null;
type Extracted = {
  viscosity: Field<string>;
  qtWithFilter: Field<number>;
  drainTq: Field<number>;
  socketMm: Field<number>;
};
type Row = "viscosity" | "qtWithFilter" | "drainTq" | "socketMm";
type Shot = { id: string; file: Blob; name: string; url: string };

const ROWS: { k: Row; label: string; mode: "text" | "decimal" }[] = [
  { k: "viscosity", label: "Viscosity", mode: "text" },
  { k: "qtWithFilter", label: "Capacity (qt w/ filter)", mode: "decimal" },
  { k: "drainTq", label: "Drain plug torque (ft-lb)", mode: "decimal" },
  { k: "socketMm", label: "Socket (mm)", mode: "decimal" },
];

async function shrink(file: File): Promise<Blob> {
  if (file.size <= SHRINK_OVER_BYTES || !/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / bmp.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function isImage(f: File): boolean {
  return f.type.startsWith("image/") || /\.(hei[cf]|png|jpe?g|webp)$/i.test(f.name || "");
}

/**
 * "Add from O'Reilly screenshots": O'Reilly Pro shows each oil spec on its own screen with no
 * vehicle on it, so the tech picks/pastes several screenshots → server vision extraction
 * (read-only) → confirm card for THIS record's vehicle → Save as verified writes the shop spec.
 * Nothing is written before Save.
 */
export function OilScreenshotImport({
  vehicleId,
  specId,
  year,
  make,
  model,
  engine,
  trim,
  className = "",
}: {
  /** Vehicle/job screens: the server resolves year/make/model/engine from this record. */
  vehicleId?: string;
  /** /specs screen: the server resolves the vehicle from this spec row. */
  specId?: string;
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  trim?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const eng = engine && engine !== "__unsure__" ? String(engine).trim() : "";
  const vehicleText =
    [year, make, model, trim]
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .join(" ") + (eng ? ` · ${eng}` : "");
  const [open, setOpen] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState<"" | "read" | "save">("");
  const [error, setError] = useState("");
  const [disabledMsg, setDisabledMsg] = useState("");
  const [found, setFound] = useState<Extracted | null>(null);
  const [draft, setDraft] = useState<Record<Row, string> | null>(null);
  const [capNoFilter, setCapNoFilter] = useState(false);
  const [saved, setSaved] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);

  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

  function reset() {
    shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setFound(null);
    setDraft(null);
    setCapNoFilter(false);
    setError("");
  }

  function checkConfigured() {
    fetch("/api/oil/extract", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { configured?: boolean; error?: string };
        setDisabledMsg(!res.ok || json.configured === false ? json.error || "Screenshot import is not available." : "");
      })
      .catch(() => setDisabledMsg(""));
  }

  function start() {
    setOpen(true);
    setSaved("");
    reset();
    checkConfigured();
    fileRef.current?.click(); // must stay synchronous in the tap for mobile pickers
  }

  function addFiles(files: File[]) {
    setError("");
    const imgs = files.filter(isImage);
    if (imgs.length < files.length) setError("Only images can be added.");
    if (imgs.length > MAX_IMAGES - shotsRef.current.length) setError(`Up to ${MAX_IMAGES} screenshots at a time.`);
    setShots((cur) => {
      const room = MAX_IMAGES - cur.length;
      return [
        ...cur,
        ...imgs.slice(0, Math.max(0, room)).map((f) => ({
          id: crypto.randomUUID(),
          file: f,
          name: f.name || "screenshot.png",
          url: URL.createObjectURL(f),
        })),
      ];
    });
  }

  function removeShot(id: string) {
    setShots((cur) => {
      const s = cur.find((x) => x.id === id);
      if (s) URL.revokeObjectURL(s.url);
      return cur.filter((x) => x.id !== id);
    });
  }

  const addRef = useRef(addFiles);
  useEffect(() => {
    addRef.current = addFiles;
  });

  // Desktop: Ctrl/Cmd+V screenshots while the panel is open (before reading).
  const acceptPaste = open && !disabledMsg && !draft;
  useEffect(() => {
    if (!acceptPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => Boolean(f));
      if (files.length) {
        e.preventDefault();
        addRef.current(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptPaste]);

  async function readSpecs() {
    if (!shots.length || busy) return;
    setBusy("read");
    setError("");
    try {
      const fd = new FormData();
      let total = 0;
      for (const s of shots) {
        const blob = s.file instanceof File ? await shrink(s.file) : s.file;
        total += blob.size;
        fd.append("image", blob, s.name);
      }
      if (total > MAX_TOTAL_BYTES) {
        setError("Those screenshots are too large together. Remove one or crop them.");
        return;
      }
      const res = await fetch("/api/oil/extract", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        fields?: Extracted;
        capacityWithoutFilter?: boolean;
        error?: string;
        code?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.fields) {
        if (json?.code === "not_configured") setDisabledMsg(json.error || "");
        setError(
          json?.error ||
            (res.status === 413
              ? "Screenshots are too large. Remove one or crop them."
              : "Could not read those screenshots. Type the spec in."),
        );
        return;
      }
      const f = json.fields;
      setFound(f);
      setCapNoFilter(Boolean(json.capacityWithoutFilter));
      setDraft({
        viscosity: f.viscosity ? f.viscosity.value : "",
        qtWithFilter: f.qtWithFilter ? String(f.qtWithFilter.value) : "",
        drainTq: f.drainTq ? String(f.drainTq.value) : "",
        socketMm: f.socketMm ? String(f.socketMm.value) : "",
      });
    } catch {
      setError("Could not upload those screenshots. Check your connection, or type the spec in.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const res = await fetch("/api/oil/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(vehicleId ? { vehicleId } : specId ? { specId } : { year, make, model, engine: eng }),
          viscosity: draft.viscosity,
          qtWithFilter: draft.qtWithFilter,
          drainTq: draft.drainTq,
          socketMm: draft.socketMm,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Could not save that spec. Try again.");
        return;
      }
      setSaved(`Saved as verified for ${vehicleText}.`);
      reset();
      setOpen(false);
      window.dispatchEvent(new CustomEvent(OIL_SAVED_EVENT));
      router.refresh();
    } catch {
      setError("Could not save that spec. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  const hasAny = Boolean(draft && Object.values(draft).some((v) => v.trim()));
  const picker = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        addFiles(Array.from(e.target.files ?? []));
        e.target.value = "";
      }}
    />
  );

  // The file input stays mounted in one place: the picker opens on the first tap, before the
  // panel renders, and its change event must reach the same element.
  return (
    <div className={className}>
      {picker}
      {!open ? (
        <>
          {saved ? <p className="mb-2 text-sm font-bold text-green">{saved}</p> : null}
          <button type="button" className="tap tap-ghost" onClick={start}>
            Add from O&apos;Reilly screenshots
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-white/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="lbl mb-0 mt-0">O&apos;Reilly screenshots</p>
            {!draft ? (
              <button
                type="button"
                className="text-sm text-muted underline"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Close
              </button>
            ) : null}
          </div>

          {disabledMsg ? (
            <p className="mt-2 text-sm font-bold text-amber">{disabledMsg}. Type the spec in the form instead.</p>
          ) : null}

          {shots.length ? (
            <ol className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {shots.map((s, i) => (
                <li key={s.id} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img
                    src={s.url}
                    alt={`Screenshot ${i + 1}`}
                    className="h-20 w-16 rounded border border-white/20 object-cover object-top"
                  />
                  <span className="absolute bottom-0 left-0 rounded-tr bg-black/70 px-1 text-xs text-white">{i + 1}</span>
                  {!draft ? (
                    <button
                      type="button"
                      aria-label={`Remove screenshot ${i + 1}`}
                      className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-black text-sm leading-6 text-white!"
                      onClick={() => removeShot(s.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {!draft && !disabledMsg ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Add the O&apos;Reilly Pro screens for viscosity, oil capacity, and drain plug torque. Paste (Ctrl/Cmd+V)
                or pick them. Nothing saves until you check the values and tap Save as verified.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="tap tap-ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy === "read" || shots.length >= MAX_IMAGES}
                >
                  {shots.length ? "Add more" : "Pick screenshots"}
                </button>
                <button type="button" className="tap" onClick={readSpecs} disabled={!shots.length || busy === "read"}>
                  {busy === "read" ? "Reading…" : "Read specs"}
                </button>
              </div>
            </>
          ) : null}

          {draft && found ? (
            <div
              className="mt-3"
              onKeyDown={(e) => {
                // This card can sit inside the create-job form: Enter must not submit that form.
                if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
              }}
            >
              <p className="font-bold">{vehicleText || "This vehicle"}</p>
              {ROWS.map(({ k, label, mode }) => {
                const src = found[k];
                const unchanged = src && draft[k].trim() === String(src.value);
                return (
                  <div key={k}>
                    <label className="lbl">{label}</label>
                    <input
                      className="field"
                      value={draft[k]}
                      onChange={(e) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d))}
                      inputMode={mode}
                      autoCapitalize={k === "viscosity" ? "characters" : undefined}
                      placeholder="Not found in screenshots"
                      autoComplete="off"
                    />
                    {src && unchanged ? <p className="mt-1 text-xs text-muted">from image {src.image}</p> : null}
                    {k === "qtWithFilter" && capNoFilter && !draft[k].trim() ? (
                      <p className="mt-1 text-xs text-muted">Only capacity with filter is saved</p>
                    ) : null}
                  </div>
                );
              })}
              <button className="tap mt-4" type="button" onClick={save} disabled={busy === "save" || !hasAny}>
                {busy === "save" ? "Saving…" : "Save as verified"}
              </button>
              <button
                type="button"
                className="tap tap-ghost mt-2"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Cancel
              </button>
              <p className="mt-2 text-xs text-muted">Blank fields keep anything already saved for this vehicle.</p>
            </div>
          ) : null}

          {error ? <p className="mt-2 text-sm font-bold text-red">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
