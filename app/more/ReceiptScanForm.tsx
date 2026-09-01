"use client";

import { useRef, useState } from "react";
import { denverDateISO } from "@/lib/format";

function parseReceiptText(text: string): { amount: string; vendor: string; date: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let amount = "";
  const moneyHits = [...text.matchAll(/\$?\s*(\d{1,4}[.,]\d{2})\b/g)].map((m) => m[1].replace(",", "."));
  if (moneyHits.length) {
    const nums = moneyHits.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n < 20000);
    if (nums.length) amount = Math.max(...nums).toFixed(2);
  }
  const vendor = lines.find((l) => /[A-Za-z]{3,}/.test(l) && !/total|visa|mastercard|change|subtotal|tax/i.test(l)) ?? "";
  let date = "";
  const dm = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dm) {
    const y = dm[3].length === 2 ? `20${dm[3]}` : dm[3];
    date = `${y}-${dm[1].padStart(2, "0")}-${dm[2].padStart(2, "0")}`;
    if (date.slice(5, 7) > "12") date = `${y}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }
  return { amount, vendor: vendor.slice(0, 80), date };
}

export function ReceiptScanForm({
  jobs,
  defaultDate,
}: {
  jobs: { id: string; label: string }[];
  defaultDate: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(defaultDate || denverDateISO());
  const [note, setNote] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setNote(null);
    setPreview(URL.createObjectURL(file));
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const parsed = parseReceiptText(String(data.text ?? ""));
      if (parsed.amount) setAmount(parsed.amount);
      if (parsed.vendor) setVendor(parsed.vendor);
      if (parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) setDate(parsed.date);
      setNote(parsed.amount || parsed.vendor ? "Check the fields, then save." : "Couldn’t read totals — type them.");
    } catch {
      setNote("Couldn’t read the photo — type amount and vendor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action="/api/shop" method="post" encType="multipart/form-data" className="panel">
      <input type="hidden" name="_op" value="add_receipt" />
      <input
        ref={ref}
        className="sr-only"
        type="file"
        name="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        className="tap"
        onClick={() => ref.current?.click()}
        disabled={busy}
      >
        {busy ? "Reading receipt…" : "Scan receipt"}
      </button>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Receipt preview" className="mt-3 max-h-48 w-full rounded object-contain" />
      ) : null}
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      <label className="lbl">Amount $</label>
      <input className="field" name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="lbl">Vendor</label>
      <input className="field" name="vendor" required value={vendor} onChange={(e) => setVendor(e.target.value)} />
      <label className="lbl">Category</label>
      <select className="field" name="category" defaultValue="parts">
        <option value="parts">Parts</option>
        <option value="fuel">Fuel</option>
        <option value="shop">Shop</option>
        <option value="other">Other</option>
      </select>
      <label className="lbl">Date</label>
      <input className="field" type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="lbl">Link to job (optional)</label>
      <select className="field" name="job_id" defaultValue="">
        <option value="">None</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-muted">Linked receipts reduce that job’s profit. You can skip the camera and type.</p>
      <button className="tap mt-4" type="submit">
        Save receipt
      </button>
    </form>
  );
}
