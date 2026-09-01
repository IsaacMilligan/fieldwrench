"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMMON_MAKES, commonMakeValue, ELECTRIC_ENGINE, isKnownBev } from "@/lib/vpic";
import { ScanVinButton } from "@/components/ScanVinButton";
import { vinOk } from "@/lib/format";

type Saved = { year: number | null; make: string; model: string; engine?: string };

async function load(kind: string, q: Record<string, string | number>) {
  const p = new URLSearchParams({
    kind,
    ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])),
  });
  const res = await fetch(`/api/vpic?${p.toString()}`, { cache: "no-store" });
  const json = (await res.json()) as { ok?: boolean; options?: string[]; error?: string };
  if (!json.ok) throw new Error(json.error || "Lookup failed.");
  return json.options ?? [];
}

export function VehiclePicker({
  saved = [],
  initial,
  onYmme,
  withVin = false,
}: {
  saved?: Saved[];
  initial?: { year?: number | null; make?: string; model?: string; engine?: string };
  onYmme?: (v: { year: string; make: string; model: string; engine: string }) => void;
  withVin?: boolean;
}) {
  const years = useMemo(() => {
    const top = new Date().getFullYear() + 1;
    const list: number[] = [];
    for (let y = top; y >= 1990; y--) list.push(y);
    return list;
  }, []);

  const knownInit = initial?.make ? commonMakeValue(initial.make) : null;
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [brand, setBrand] = useState(knownInit ?? (initial?.make ? "Other" : ""));
  const [otherMake, setOtherMake] = useState(knownInit || !initial?.make ? "" : initial.make);
  const [allMakes, setAllMakes] = useState<string[]>([]);
  const [model, setModel] = useState(initial?.model ?? "");
  const [engine, setEngine] = useState(initial?.engine && initial.engine !== "__unsure__" ? initial.engine : "");
  const [models, setModels] = useState<string[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [freeModel, setFreeModel] = useState(false);
  const [engineFallback, setEngineFallback] = useState(false);
  const [busy, setBusy] = useState<"models" | "engines" | "makes-all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vin, setVin] = useState("");
  const [vinBusy, setVinBusy] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const seedRef = useRef<{ year: string; make: string; model: string; engine: string } | null>(null);

  const make = brand === "Other" ? otherMake.trim() : brand;

  useEffect(() => {
    onYmme?.({ year, make, model, engine });
  }, [year, make, model, engine, onYmme]);

  const otherHits = useMemo(() => {
    const q = otherMake.trim().toLowerCase();
    if (q.length < 1) return allMakes.slice(0, 40);
    return allMakes.filter((m) => m.toLowerCase().includes(q)).slice(0, 40);
  }, [allMakes, otherMake]);

  useEffect(() => {
    if (brand !== "Other" || allMakes.length) return;
    let live = true;
    setBusy("makes-all");
    load("makes-all", {})
      .then((opts) => {
        if (live) setAllMakes(opts);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [brand, allMakes.length]);

  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      setModel("");
      setEngine("");
      setEngines([]);
      setFreeModel(false);
      setEngineFallback(false);
      return;
    }
    let live = true;
    setBusy("models");
    setError(null);
    setFreeModel(false);
    load("models", { year, make })
      .then((opts) => {
        if (!live) return;
        const seed = seedRef.current;
        const seedHere = seed && seed.year === year && seed.make === make;
        if (!opts.length) {
          setModels([]);
          setFreeModel(true);
          return;
        }
        setModels(opts);
        if (seedHere && seed.model && !opts.includes(seed.model)) setFreeModel(true);
      })
      .catch((e: Error) => {
        if (!live) return;
        setModels([]);
        setFreeModel(true);
        setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [year, make]);

  useEffect(() => {
    if (!year || !make || !model) {
      setEngines([]);
      setEngine("");
      setEngineFallback(false);
      return;
    }
    if (isKnownBev(make, model)) {
      setEngines([ELECTRIC_ENGINE]);
      setEngine(ELECTRIC_ENGINE);
      setEngineFallback(false);
      return;
    }
    let live = true;
    setBusy("engines");
    setError(null);
    setEngineFallback(false);
    const seed = seedRef.current;
    const seedHere =
      seed && seed.year === year && seed.make === make && seed.model === model ? seed : null;
    if (!seedHere?.engine) setEngine("");
    load("engines", { year, make, model })
      .then((opts) => {
        if (!live) return;
        const keep = seedHere?.engine || "";
        if (!opts.length) {
          setEngines([]);
          setEngineFallback(true);
          if (keep) setEngine(keep);
          else if (initial?.engine) setEngine(initial.engine);
          return;
        }
        setEngines(opts);
        setEngineFallback(false);
        if (opts.length === 1 && opts[0] === "Electric") setEngine("Electric");
        else if (keep && opts.includes(keep)) setEngine(keep);
        else if (keep) {
          setEngineFallback(true);
          setEngine(keep);
        } else if (initial?.engine && opts.includes(initial.engine)) setEngine(initial.engine);
      })
      .catch(() => {
        if (!live) return;
        setEngines([]);
        setEngineFallback(true);
        setError(null);
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [year, make, model]);

  function applyFill(d: { year?: number | null; make: string; model: string; engine: string }) {
    const y = d.year ? String(d.year) : "";
    const known = commonMakeValue(d.make);
    const resolvedMake = known ?? d.make;
    seedRef.current = { year: y, make: resolvedMake, model: d.model, engine: d.engine };
    if (y) setYear(y);
    if (known) {
      setBrand(known);
      setOtherMake("");
    } else if (d.make) {
      setBrand("Other");
      setOtherMake(d.make);
    }
    if (d.model) setModel(d.model);
    if (d.engine) setEngine(d.engine);
  }

  async function decodeVin(raw: string) {
    const v = raw.trim().toUpperCase();
    if (!vinOk(v)) {
      setVinError("VIN must be 17 characters. Letters I, O, and Q are not used.");
      return;
    }
    setVinBusy(true);
    setVinError(null);
    try {
      const res = await fetch("/api/vin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vin: v }),
      });
      const json = (await res.json()) as {
        error?: string;
        year?: number | null;
        make?: string;
        model?: string;
        engine?: string;
        bev?: boolean;
      };
      if (json.error) {
        setVinError(json.error);
        return;
      }
      applyFill({
        year: json.year,
        make: json.make ?? "",
        model: json.model ?? "",
        engine: json.engine || (json.bev ? ELECTRIC_ENGINE : ""),
      });
    } catch {
      setVinError("Couldn’t decode that VIN. Year / Make / Model still work.");
    } finally {
      setVinBusy(false);
    }
  }

  function applySaved(idx: string) {
    const v = saved[Number(idx)];
    if (!v?.year || !v.make || !v.model) return;
    setYear(String(v.year));
    const known = commonMakeValue(v.make);
    if (known) {
      setBrand(known);
      setOtherMake("");
    } else {
      setBrand("Other");
      setOtherMake(v.make);
    }
    setModel(v.model);
    setEngine("");
  }

  const retry = () => {
    if (busy || !year) return;
    setError(null);
    if (brand === "Other" && !allMakes.length) {
      setBusy("makes-all");
      load("makes-all", {})
        .then(setAllMakes)
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(null));
      return;
    }
    if (make && model) {
      setBusy("engines");
      load("engines", { year, make, model })
        .then((opts) => {
          if (!opts.length) {
            setEngines([]);
            setEngineFallback(true);
          } else {
            setEngines(opts);
            setEngineFallback(false);
          }
        })
        .catch(() => {
          setEngines([]);
          setEngineFallback(true);
        })
        .finally(() => setBusy(null));
    } else if (make) {
      setBusy("models");
      load("models", { year, make })
        .then((opts) => {
          if (!opts.length) setFreeModel(true);
          else {
            setFreeModel(false);
            setModels(opts);
          }
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(null));
    }
  };

  return (
    <div>
      {withVin ? (
        <>
          <label className="lbl" htmlFor="vehicle_vin">
            VIN
          </label>
          <input
            id="vehicle_vin"
            className="field font-mono uppercase"
            name="vin"
            value={vin}
            maxLength={17}
            autoComplete="off"
            placeholder="Optional — 17 characters"
            onChange={(e) => {
              setVin(e.target.value.toUpperCase());
              setVinError(null);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <ScanVinButton
              onVin={(v) => {
                setVin(v);
                void decodeVin(v);
              }}
            />
            <button
              type="button"
              className="flex h-11 items-center justify-center rounded-lg border-2 border-amber px-4 text-sm font-extrabold uppercase tracking-widest text-amber disabled:opacity-50"
              disabled={vinBusy}
              onClick={() => void decodeVin(vin)}
            >
              {vinBusy ? "Decoding…" : "Decode"}
            </button>
          </div>
          {vinError ? <p className="mt-2 text-sm font-bold text-red">{vinError}</p> : null}
          <p className="mt-2 text-sm text-muted">VIN is optional. Decode fills Year / Make / Model / Engine.</p>
        </>
      ) : null}

      {saved.length ? (
        <>
          <label className="lbl">Vehicle on file</label>
          <select className="field" defaultValue="" onChange={(e) => applySaved(e.target.value)}>
            <option value="">Pick a saved vehicle, or choose below</option>
            {saved.map((v, i) => (
              <option key={`${v.year}-${v.make}-${v.model}-${i}`} value={String(i)}>
                {[v.year, v.make, v.model].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className="lbl" htmlFor="vehicle_year">
        Year
      </label>
      <select
        className="field"
        id="vehicle_year"
        name="vehicle_year"
        required
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          setBrand("");
          setOtherMake("");
          setModel("");
          setEngine("");
          setModels([]);
          setEngines([]);
          setFreeModel(false);
          setEngineFallback(false);
        }}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <label className="lbl" htmlFor="vehicle_make_pick">
        Make
      </label>
      <select
        className="field"
        id="vehicle_make_pick"
        required={brand !== "Other"}
        disabled={!year}
        value={brand}
        onChange={(e) => {
          setBrand(e.target.value);
          setOtherMake("");
          setModel("");
          setEngine("");
          setModels([]);
          setEngines([]);
          setFreeModel(false);
          setEngineFallback(false);
        }}
      >
        <option value="">Make</option>
        {COMMON_MAKES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
        <option value="Other">Other</option>
      </select>
      <input type="hidden" name="vehicle_make" value={make} />

      {brand === "Other" ? (
        <>
          <label className="lbl" htmlFor="vehicle_make_other">
            Other make
          </label>
          <input
            className="field"
            id="vehicle_make_other"
            list="fw-make-all"
            required
            disabled={!year}
            value={otherMake}
            onChange={(e) => {
              setOtherMake(e.target.value);
              setModel("");
              setEngine("");
            }}
            placeholder={busy === "makes-all" ? "Loading makes…" : "Start typing a make"}
            autoComplete="off"
          />
          <datalist id="fw-make-all">
            {otherHits.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </>
      ) : null}

      <label className="lbl" htmlFor="vehicle_model">
        Model
      </label>
      {freeModel ? (
        <input
          className="field"
          id="vehicle_model"
          name="vehicle_model"
          required
          disabled={!make}
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setEngine("");
          }}
          placeholder="Model"
        />
      ) : (
        <select
          className="field"
          id="vehicle_model"
          name="vehicle_model"
          required
          disabled={!make || busy === "models"}
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setEngine("");
          }}
        >
          <option value="">{busy === "models" ? "Loading models…" : "Model"}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      <label className="lbl" htmlFor="vehicle_engine">
        Engine size
      </label>
      {engines.length === 1 && engines[0] === "Electric" ? (
        <>
          <input type="hidden" name="vehicle_engine" value="Electric" />
          <div className="field flex items-center font-bold">Electric</div>
        </>
      ) : engineFallback ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Couldn&apos;t load engines for this vehicle — type it or pick Not sure.
          </p>
          <input
            className="field"
            id="vehicle_engine"
            name={engine === "__unsure__" ? undefined : "vehicle_engine"}
            disabled={!model}
            value={engine === "__unsure__" ? "" : engine}
            onChange={(e) => setEngine(e.target.value)}
            placeholder="e.g. 3.7L V6"
          />
          {engine === "__unsure__" ? (
            <input type="hidden" name="vehicle_engine" value="__unsure__" />
          ) : null}
          <button
            className="tap tap-ghost mt-2"
            type="button"
            onClick={() => setEngine("__unsure__")}
          >
            Not sure
          </button>
          {engine === "__unsure__" ? (
            <p className="mt-2 text-sm text-muted">Engine: not specified</p>
          ) : null}
        </>
      ) : (
        <select
          className="field"
          id="vehicle_engine"
          name="vehicle_engine"
          required={engines.length > 0}
          disabled={!model || busy === "engines"}
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
        >
          <option value="">{busy === "engines" ? "Loading engines…" : "Engine size"}</option>
          {engines.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      {error ? (
        <div className="mt-3">
          <p className="text-lg font-bold text-red">{error}</p>
          <button className="tap tap-ghost mt-2" type="button" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
