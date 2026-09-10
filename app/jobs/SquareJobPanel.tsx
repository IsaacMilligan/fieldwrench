"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  not_sent: "Not sent",
  sent: "Sent",
  partially_paid: "Partial",
  paid: "Paid",
  canceled: "Canceled",
  failed: "Failed",
};

export function SquareJobPanel({
  jobId,
  configured,
  status,
  publicUrl,
  kind,
  error,
  pageError,
}: {
  jobId: string;
  configured: boolean;
  status: string;
  publicUrl: string;
  kind: string;
  error: string;
  pageError?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(pageError || error || "");
  const [copied, setCopied] = useState(false);
  const badge = STATUS_LABEL[status] || (status ? status : "Not sent");

  useEffect(() => {
    if (!configured || !status || status === "not_sent" || status === "failed") return;
    const fd = new FormData();
    fd.set("_op", "refresh_square");
    fd.set("job_id", jobId);
    fetch("/api/shop", {
      method: "POST",
      body: fd,
      headers: { "x-fw-ajax": "1", Accept: "application/json" },
      redirect: "manual",
    })
      .then(() => router.refresh())
      .catch(() => null);
    // refresh once on load; Square down must not block the job
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function post(op: string) {
    setBusy(op);
    setErr("");
    const fd = new FormData();
    fd.set("_op", op);
    fd.set("job_id", jobId);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        body: fd,
        headers: { "x-fw-ajax": "1", Accept: "application/json" },
        redirect: "manual",
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (data && data.ok === false) {
        setErr(data.error || "Square request failed.");
        setBusy("");
        return;
      }
      if (!res.ok && res.status !== 204 && res.status !== 303 && res.status !== 302 && res.status !== 0) {
        setErr("Square request failed.");
        setBusy("");
        return;
      }
    } catch {
      setErr("Square request failed.");
      setBusy("");
      return;
    }
    setBusy("");
    router.refresh();
    requestAnimationFrame(() => document.getElementById("square")?.scrollIntoView({ block: "start" }));
  }

  if (!configured) {
    return (
      <div id="square" className="mt-4 panel">
        <p className="text-sm font-bold">Connect Square in Settings / Vercel env</p>
        <p className="mt-1 text-xs text-muted">
          Add SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and SQUARE_ENVIRONMENT on Vercel, then redeploy.
        </p>
        <Link href="/more?tab=settings#square" className="tap tap-steel mt-3 flex items-center justify-center">
          Settings
        </Link>
      </div>
    );
  }

  return (
    <div id="square" className="mt-4 panel">
      <div className="flex items-center justify-between gap-2">
        <p className="font-extrabold uppercase tracking-widest text-[12px] text-muted">Square</p>
        <span className="badge badge-amber">{kind === "estimate" ? `Estimate · ${badge}` : badge}</span>
      </div>
      {err ? <p className="mt-2 text-sm font-bold text-red">{err}</p> : null}
      <button className="tap mt-3" type="button" disabled={Boolean(busy)} onClick={() => post("send_square_invoice")}>
        {busy === "send_square_invoice" ? "Sending…" : "Send Square invoice"}
      </button>
      {publicUrl ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a className="tap tap-steel flex items-center justify-center" href={publicUrl} target="_blank" rel="noreferrer">
            Open in Square
          </a>
          <button
            className="tap tap-ghost"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              } catch {
                setErr("Could not copy.");
              }
            }}
          >
            {copied ? "Copied" : "Copy payment link"}
          </button>
        </div>
      ) : null}
      {status && status !== "not_sent" ? (
        <button className="tap tap-steel mt-2" type="button" disabled={Boolean(busy)} onClick={() => post("refresh_square")}>
          {busy === "refresh_square" ? "Checking…" : "Refresh status"}
        </button>
      ) : null}
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-bold text-muted [&::-webkit-details-marker]:hidden">
          More
        </summary>
        <button className="tap tap-ghost mt-2" type="button" disabled={Boolean(busy)} onClick={() => post("send_square_estimate")}>
          {busy === "send_square_estimate" ? "Creating…" : "Create Square estimate"}
        </button>
        <p className="mt-1 text-xs text-muted">Draft invoice in Square (not published). Totals stay on this job.</p>
      </details>
    </div>
  );
}
