"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { oilYmmeKey } from "@/lib/oil-specs";

/** Fired after a successful import save so client oil hints (create-job) can refetch. */
export const OIL_SAVED_EVENT = "fw-oil-spec-saved";

type Ymme = { year: string; make: string; model: string; engine: string };
type Extracted = {
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  viscosity: string | null;
  qtWithFilter: number | null;
  drainTq: number | null;
  socketMm: number | null;
};
type Draft = Ymme & { viscosity: string; qt: string; tq: string; socket: string };
type YKey = keyof Ymme;

const YMME: { k: YKey; label: string }[] = [
  { k: "year", label: "Year" },
  { k: "make", label: "Make" },
  { k: "model", label: "Model" },
  { k: "engine", label: "Engine" },
];

/** Keep phone uploads under the serverless request limit (~4.5 MB on Vercel). */
const SEND_TARGET_BYTES = 3_500_000;

function norm(k: YKey, v: string): string {
  const t = String(v ?? "").trim().toLowerCase();
  if (k === "year") return String(Number(t) || "");
  if (k === "make") return t.replace(/\s+/g, " ");
  if (k === "model") return t.replace(/[^a-z0-9]/g, "");
  return t.replace(/[^a-z0-9.]/g, "");
}

/** Same vehicle value? Engines match on displacement ("2.5L" vs "2.5L L4 DOHC"). */
function same(k: YKey, a: string, b: string): boolean {
  if (norm(k, a) === norm(k, b)) return true;
  if (k === "engine") {
    const d = (s: string) => s.match(/(\d{1,2}\.\d)\s*l?/i)?.[1] ?? "";
    return Boolean(d(a)) && d(a) === d(b);
  }
  return false;
}

async function shrink(file: File): Promise<Blob> {
  if (file.size <= SEND_TARGET_BYTES || !/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / bmp.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * "Add from O'Reilly screenshot": paste (desktop) or pick/take (mobile) a screenshot of an
 * O'Reilly Pro spec page → server vision extraction (read-only) → editable confirm card →
 * Save writes a verified shop spec. Nothing is written before Save.
 */
export function OilScreenshotImport({
  year,
  make,
  model,
  engine,
  className = "",
}: {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const vehicle: Ymme = {
    year: year ? String(year) : "",
    make: String(make ?? "").trim(),
    model: String(model ?? "").trim(),
    engine: engine && engine !== "__unsure__" ? String(engine).trim() : "",
  };
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "check" | "read" | "save">("");
  const [error, setError] = useState("");
  const [disabledMsg, setDisabledMsg] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fromShot, setFromShot] = useState<Record<string, boolean>>({});
  const [conflicts, setConflicts] = useState<{ label: string; shot: string; veh: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  async function openPanel() {
    setOpen(true);
    setError("");
    setSaved("");
    setBusy("check");
    try {
      const res = await fetch("/api/oil/extract", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { configured?: boolean; error?: string };
      if (!res.ok || json.configured === false) {
        setDisabledMsg(json.error || "Screenshot import is not available right now.");
      } else setDisabledMsg("");
    } catch {
      setDisabledMsg("");
    } finally {
      setBusy("");
    }
  }

  async function read(file: File | Blob | null) {
    if (!file || busyRef.current) return;
    if (file.type && !file.type.startsWith("image/") && !/\.hei[cf]$/i.test((file as File).name || "")) {
      setError("That is not an image. Use a PNG or JPEG screenshot.");
      return;
    }
    busyRef.current = true;
    setBusy("read");
    setError("");
    setSaved("");
    setDraft(null);
    try {
      const blob = file instanceof File ? await shrink(file) : file;
      const fd = new FormData();
      fd.set("image", blob, (file as File).name || "screenshot.png");
      const res = await fetch("/api/oil/extract", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; fields?: Extracted; notes?: string | null; error?: string; code?: string }
        | null;
      if (!res.ok || !json?.ok || !json.fields) {
        if (json?.code === "not_configured") setDisabledMsg(json.error || "");
        setError(
          json?.error ||
            (res.status === 413
              ? "Screenshot is too large. Crop it to the oil spec section."
              : "Could not read that screenshot. Type the spec in below."),
        );
        return;
      }
      const f = json.fields;
      const shot: Ymme = {
        year: f.year ? String(f.year) : "",
        make: f.make ?? "",
        model: f.model ?? "",
        engine: f.engine ?? "",
      };
      const next: Ymme = { ...vehicle };
      const found: { label: string; shot: string; veh: string }[] = [];
      for (const { k, label } of YMME) {
        if (!shot[k]) continue; // screenshot omits it → keep the vehicle's value
        if (!vehicle[k]) next[k] = shot[k];
        else if (same(k, vehicle[k], shot[k])) next[k] = vehicle[k]; // keep the exact vehicle key
        else {
          next[k] = shot[k];
          found.push({ label, shot: shot[k], veh: vehicle[k] });
        }
      }
      setConflicts(found);
      setFromShot({
        viscosity: Boolean(f.viscosity),
        qt: f.qtWithFilter != null,
        tq: f.drainTq != null,
        socket: f.socketMm != null,
      });
      setNotes(json.notes || "");
      setDraft({
        ...next,
        viscosity: f.viscosity ?? "",
        qt: f.qtWithFilter != null ? String(f.qtWithFilter) : "",
        tq: f.drainTq != null ? String(f.drainTq) : "",
        socket: f.socketMm != null ? String(f.socketMm) : "",
      });
    } catch {
      setError("Could not upload that screenshot. Check your connection, or type the spec in below.");
    } finally {
      busyRef.current = false;
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });

  // Desktop: Ctrl/Cmd+V a screenshot anywhere on the page while the panel is open.
  useEffect(() => {
    if (!open || disabledMsg) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void readRef.current(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, disabledMsg]);

  async function save() {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const res = await fetch("/api/oil/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          year: draft.year,
          make: draft.make,
          model: draft.model,
          engine: draft.engine,
          viscosity: draft.viscosity,
          qtWithFilter: draft.qt,
          drainTq: draft.tq,
          socketMm: draft.socket,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Could not save that spec. Try again.");
        return;
      }
      setSaved(`Saved verified spec for ${draft.year} ${draft.make} ${draft.model}${draft.engine ? ` ${draft.engine}` : ""}.`);
      setDraft(null);
      window.dispatchEvent(new CustomEvent(OIL_SAVED_EVENT));
      router.refresh();
    } catch {
      setError("Could not save that spec. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  const draftKey = draft ? oilYmmeKey(Number(draft.year), draft.make, draft.model, draft.engine) : null;
  const vehKey = oilYmmeKey(Number(vehicle.year), vehicle.make, vehicle.model, vehicle.engine);
  const differs =
    Boolean(draftKey && vehKey) && JSON.stringify(draftKey) !== JSON.stringify(vehKey);
  const hasOil = Boolean(draft && (draft.viscosity.trim() || draft.qt.trim() || draft.tq.trim() || draft.socket.trim()));

  if (!open) {
    return (
      <div className={className}>
        {saved ? <p className="mb-2 text-sm font-bold text-green">{saved}</p> : null}
        <button type="button" className="tap tap-ghost" onClick={openPanel}>
          Add from O&apos;Reilly screenshot
        </button>
      </div>
    );
  }

  const blankHint = (k: string) =>
    draft && !fromShot[k] ? <span className="text-xs text-amber"> · not read</span> : null;

  return (
    <div className={`rounded-lg border border-white/15 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="lbl mb-0 mt-0">O&apos;Reilly screenshot</p>
        <button
          type="button"
          className="text-sm text-muted underline"
          onClick={() => {
            setOpen(false);
            setDraft(null);
            setError("");
          }}
        >
          Close
        </button>
      </div>

      {busy === "check" ? <p className="mt-2 text-sm text-muted">Checking…</p> : null}
      {disabledMsg ? (
        <p className="mt-2 text-sm font-bold text-amber">{disabledMsg}. Type the spec in the form instead.</p>
      ) : null}

      {!disabledMsg && busy !== "check" && !draft ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Screenshot the oil / fluids spec on O&apos;Reilly Pro, then paste it here (Ctrl/Cmd+V) or pick it.
            Nothing saves until you check it and tap Save.
          </p>
          <div
            tabIndex={0}
            className="mt-2 rounded border border-dashed border-white/25 p-4 text-center text-sm text-muted outline-none focus:border-amber"
          >
            {busy === "read" ? "Reading screenshot…" : "Paste screenshot here"}
          </div>
          <label className="tap tap-steel mt-2 flex cursor-pointer items-center justify-center">
            {busy === "read" ? "Reading…" : "Choose screenshot / take photo"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy === "read"}
              onChange={(e) => void read(e.target.files?.[0] ?? null)}
            />
          </label>
        </>
      ) : null}

      {error ? <p className="mt-2 text-sm font-bold text-red">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm font-bold text-green">{saved}</p> : null}

      {draft ? (
        <div
          className="mt-3"
          onKeyDown={(e) => {
            // This card can sit inside the create-job form: Enter must not submit that form.
            if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
          }}
        >
          <p className="text-sm text-muted">
            Check every value against the screenshot. Blank = not read clearly; fill it in or leave it blank.
          </p>
          {conflicts.length ? (
            <div className="mt-2 rounded border border-amber p-2 text-sm text-amber" role="alert">
              <p className="font-bold">Screenshot does not match this vehicle:</p>
              <ul className="mt-1 list-disc pl-5">
                {conflicts.map((c) => (
                  <li key={c.label}>
                    {c.label}: screenshot “{c.shot}”, vehicle “{c.veh}”
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 underline"
                onClick={() => setDraft((d) => (d ? { ...d, ...vehicle } : d))}
              >
                Use this vehicle&apos;s year/make/model/engine
              </button>
            </div>
          ) : null}
          {differs ? (
            <p className="mt-2 text-sm font-bold text-amber" role="alert">
              Saving for a different vehicle than this one — it will not fill in here.
            </p>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {YMME.map(({ k, label }) => (
              <div key={k}>
                <label className="lbl">{label}</label>
                <input
                  className="field"
                  value={draft[k]}
                  onChange={set(k)}
                  inputMode={k === "year" ? "numeric" : undefined}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
          <label className="lbl">Viscosity{blankHint("viscosity")}</label>
          <input
            className="field"
            value={draft.viscosity}
            onChange={set("viscosity")}
            placeholder="0W-20"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <label className="lbl">Capacity (qt w/ filter){blankHint("qt")}</label>
          <input className="field" value={draft.qt} onChange={set("qt")} inputMode="decimal" placeholder="qt" autoComplete="off" />
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div>
              <label className="lbl">Drain plug (ft-lb){blankHint("tq")}</label>
              <input className="field" value={draft.tq} onChange={set("tq")} inputMode="decimal" placeholder="ft-lb" autoComplete="off" />
            </div>
            <div>
              <label className="lbl">Socket (mm){blankHint("socket")}</label>
              <input className="field" value={draft.socket} onChange={set("socket")} inputMode="decimal" placeholder="mm" autoComplete="off" />
            </div>
          </div>
          {notes ? <p className="mt-2 text-xs text-muted">Reader note: {notes}</p> : null}
          <button className="tap mt-3" type="button" onClick={save} disabled={busy === "save" || !draftKey || !hasOil}>
            {busy === "save" ? "Saving…" : "Save verified spec"}
          </button>
          {!draftKey ? <p className="mt-1 text-xs text-amber">Year, make, and model are required.</p> : null}
          <p className="mt-2 text-xs text-muted">
            Saving marks this spec verified for your shop. Blank fields keep anything already saved.
          </p>
          <button
            type="button"
            className="tap tap-ghost mt-2"
            onClick={() => {
              setDraft(null);
              setError("");
            }}
          >
            Discard · try another screenshot
          </button>
        </div>
      ) : null}
    </div>
  );
}
