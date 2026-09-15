"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PHOTO_KIND_LABEL,
  PHOTO_KIND_ORDER,
  PHOTO_KINDS,
  parsePhotoKind,
  photoKindLabel,
  type PhotoKind,
} from "@/lib/photo-kind";

function stayOnPhotos() {
  const el = document.getElementById("photos") as HTMLDetailsElement | null;
  if (el) el.open = true;
  el?.scrollIntoView({ block: "start" });
}

type Photo = { id: string; kind?: string | null };

export function JobPhotoGrid({ jobId, photos }: { jobId: string; photos: Photo[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function postOp(fd: FormData) {
    const res = await fetch("/api/shop", {
      method: "POST",
      body: fd,
      headers: { "x-fw-ajax": "1", Accept: "application/json" },
      redirect: "manual",
    });
    if (!res.ok && res.status !== 204 && res.status !== 303 && res.status !== 302 && res.status !== 0) {
      return false;
    }
    return true;
  }

  async function confirmDelete() {
    if (!pending || busy) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("_op", "delete_photo");
    fd.set("job_id", jobId);
    fd.set("photo_id", pending);
    try {
      const ok = await postOp(fd);
      if (!ok) {
        setBusy(false);
        return;
      }
    } catch {
      setBusy(false);
      return;
    }
    setPending(null);
    setBusy(false);
    router.refresh();
    requestAnimationFrame(stayOnPhotos);
    window.setTimeout(stayOnPhotos, 50);
    window.setTimeout(stayOnPhotos, 200);
  }

  async function setKind(photoId: string, kind: PhotoKind) {
    if (busy) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("_op", "set_photo_kind");
    fd.set("job_id", jobId);
    fd.set("photo_id", photoId);
    fd.set("kind", kind);
    try {
      const ok = await postOp(fd);
      if (!ok) {
        setBusy(false);
        return;
      }
    } catch {
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
    requestAnimationFrame(stayOnPhotos);
    window.setTimeout(stayOnPhotos, 50);
    window.setTimeout(stayOnPhotos, 200);
  }

  if (photos.length === 0) return null;

  const groups = PHOTO_KIND_ORDER.map((k) => ({
    key: k,
    label: k ? PHOTO_KIND_LABEL[k] : "Unlabeled",
    items: photos.filter((p) => (parsePhotoKind(p.kind) || "") === k),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {groups.map((g) => (
        <div key={g.key || "unlabeled"} className="mt-3">
          <p className="lbl">
            {g.label} · {g.items.length}
          </p>
          {g.key === "" ? (
            <p className="mb-2 text-sm font-semibold text-muted">Tap a kind so this photo is labeled.</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((ph) => (
              <div key={ph.id} className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${ph.id}`} alt={photoKindLabel(ph.kind)} className="h-36 w-full rounded object-cover" />
                <p className="badge badge-steel mt-2 w-full justify-center">{photoKindLabel(ph.kind)}</p>
                {g.key === "" ? (
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {PHOTO_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="tap tap-steel"
                        disabled={busy}
                        onClick={() => setKind(ph.id, k)}
                      >
                        {PHOTO_KIND_LABEL[k]}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button type="button" className="tap tap-red mt-2" onClick={() => setPending(ph.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {pending ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <div className="panel w-full max-w-lg bg-card p-4">
            <p className="text-lg font-bold">Delete this photo?</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="tap tap-steel" onClick={() => !busy && setPending(null)}>
                Cancel
              </button>
              <button type="button" className="tap tap-red" disabled={busy} onClick={confirmDelete}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
