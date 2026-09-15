"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PhotoKindPicker } from "./PhotoKindPicker";
import { type PhotoKind } from "@/lib/photo-kind";

async function shrinkForUpload(file: File): Promise<File> {
  if (file.size < 2_400_000 && /jpeg|jpg|png|webp/i.test(file.type || file.name)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function stayOnPhotos() {
  const el = document.getElementById("photos") as HTMLDetailsElement | null;
  if (el) el.open = true;
  el?.scrollIntoView({ block: "start" });
}

export function PhotoUploadForm({ jobId, focus }: { jobId: string; focus?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [kind, setKind] = useState<PhotoKind | "">("");

  useEffect(() => {
    if (focus) stayOnPhotos();
  }, [focus]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const raw = input?.files?.[0];
    if (!kind) {
      setErr("Pick Before, After, or Existing damage.");
      return;
    }
    if (!raw) {
      setErr("Pick a photo first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const file = await shrinkForUpload(raw);
      const fd = new FormData();
      fd.set("_op", "upload_photo");
      fd.set("job_id", jobId);
      fd.set("kind", kind);
      fd.set("file", file, file.name);
      const res = await fetch("/api/shop", {
        method: "POST",
        body: fd,
        headers: { "x-fw-ajax": "1", Accept: "application/json" },
        redirect: "manual",
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data && data.ok === false) {
        setErr(data.error || "Could not save photo.");
        setBusy(false);
        return;
      }
      if (!res.ok && res.status !== 204 && res.status !== 303 && res.status !== 302 && res.status !== 0) {
        setErr("Could not save photo.");
        setBusy(false);
        return;
      }
      setKind("");
      router.refresh();
      requestAnimationFrame(stayOnPhotos);
      window.setTimeout(stayOnPhotos, 50);
      window.setTimeout(stayOnPhotos, 200);
      if (input) input.value = "";
    } catch {
      setErr("Could not save photo.");
    }
    setBusy(false);
  }

  return (
    <form action="/api/shop" method="post" className="mt-3" onSubmit={onSubmit} encType="multipart/form-data">
      <input type="hidden" name="_op" value="upload_photo" />
      <input type="hidden" name="job_id" value={jobId} />
      <label className="lbl">Kind</label>
      <PhotoKindPicker name="kind" value={kind} onChange={setKind} />
      <label className="lbl">Upload / camera</label>
      <input
        className="field"
        type="file"
        name="file"
        accept="image/*,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        capture="environment"
      />
      {err ? <p className="mt-2 text-sm font-bold text-red">{err}</p> : null}
      <button className="tap mt-3" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save photo"}
      </button>
    </form>
  );
}
