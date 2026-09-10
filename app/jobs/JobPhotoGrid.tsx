"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function stayOnPhotos() {
  const el = document.getElementById("photos") as HTMLDetailsElement | null;
  if (el) el.open = true;
  el?.scrollIntoView({ block: "start" });
}

export function JobPhotoGrid({ jobId, photos }: { jobId: string; photos: { id: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!pending || busy) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("_op", "delete_photo");
    fd.set("job_id", jobId);
    fd.set("photo_id", pending);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        body: fd,
        headers: { "x-fw-ajax": "1", Accept: "application/json" },
        redirect: "manual",
      });
      if (!res.ok && res.status !== 204 && res.status !== 303 && res.status !== 302 && res.status !== 0) {
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

  if (photos.length === 0) return null;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {photos.map((ph) => (
          <div key={ph.id} className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${ph.id}`} alt="Job photo" className="h-36 w-full rounded object-cover" />
            <button type="button" className="tap tap-red mt-2" onClick={() => setPending(ph.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
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
