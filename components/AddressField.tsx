"use client";

import { useEffect, useRef, useState } from "react";

type Hit = { id: string; label: string; lat: number | null; lng: number | null };

export function AddressField({
  name = "address",
  defaultValue = "",
  required,
  placeholder = "Street, city, ZIP",
  latName = "address_lat",
  lngName = "address_lng",
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  latName?: string;
  lngName?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function lookup(q: string) {
    window.clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setHits([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q.trim())}`);
        const json = (await res.json()) as { disabled?: boolean; suggestions?: Hit[] };
        if (json.disabled) {
          setDisabled(true);
          setHits([]);
          return;
        }
        setDisabled(false);
        setHits(json.suggestions ?? []);
        setOpen(true);
      } catch {
        setHits([]);
      }
    }, 250);
  }

  async function pick(hit: Hit) {
    let label = hit.label;
    let la = hit.lat;
    let ln = hit.lng;
    if ((la == null || ln == null) && hit.id.startsWith("g:")) {
      try {
        const res = await fetch(`/api/places?id=${encodeURIComponent(hit.id)}`);
        const json = (await res.json()) as { suggestions?: Hit[] };
        const one = json.suggestions?.[0];
        if (one?.label) label = one.label;
        if (one?.lat != null) la = one.lat;
        if (one?.lng != null) ln = one.lng;
      } catch {
        /* keep autocomplete label */
      }
    }
    setValue(label);
    setLat(la != null && Number.isFinite(la) ? String(la) : "");
    setLng(ln != null && Number.isFinite(ln) ? String(ln) : "");
    setHits([]);
    setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <input
        className="field"
        name={name}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          setLat("");
          setLng("");
          setDisabled(false);
          lookup(e.target.value);
        }}
        onFocus={() => {
          if (hits.length) setOpen(true);
          if (value.trim().length >= 3) lookup(value);
        }}
      />
      <input type="hidden" name={latName} value={lat} />
      <input type="hidden" name={lngName} value={lng} />
      {open && hits.length ? (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded border-2 border-line bg-[var(--panel)]">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center px-3 py-2 text-left text-sm font-bold"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {disabled ? <p className="mt-2 text-xs text-muted">Address suggestions unavailable.</p> : null}
    </div>
  );
}
