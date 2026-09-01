"use client";

import { useEffect, useState } from "react";

type Saved = { year: number | null; make: string; model: string };

async function load(kind: string, q: Record<string, string | number>) {
  const p = new URLSearchParams({ kind, ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`/api/vpic?${p.toString()}`, { cache: "no-store" });
  const json = (await res.json()) as { ok?: boolean; options?: string[]; error?: string };
  if (!json.ok) throw new Error(json.error || "Lookup failed.");
  return json.options ?? [];
}

export function VehiclePicker({ saved = [] }: { saved?: Saved[] }) {
  const years = (() => {
    const top = new Date().getFullYear() + 1;
    const list: number[] = [];
    for (let y = top; y >= 1990; y--) list.push(y);
    return list;
  })();

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [engine, setEngine] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [busy, setBusy] = useState<"makes" | "models" | "engines" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetFromYear() {
    setMake("");
    setModel("");
    setEngine("");
    setModels([]);
    setEngines([]);
  }

  useEffect(() => {
    if (!year) {
      setMakes([]);
      resetFromYear();
      return;
    }
    let live = true;
    setBusy("makes");
    setError(null);
    load("makes", { year })
      .then((opts) => {
        if (!live) return;
        setMakes(opts);
      })
      .catch((e: Error) => {
        if (!live) return;
        setMakes([]);
        setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [year]);

  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      setModel("");
      setEngine("");
      setEngines([]);
      return;
    }
    let live = true;
    setBusy("models");
    setError(null);
    load("models", { year, make })
      .then((opts) => {
        if (!live) return;
        setModels(opts);
      })
      .catch((e: Error) => {
        if (!live) return;
        setModels([]);
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
      return;
    }
    let live = true;
    setBusy("engines");
    setError(null);
    load("engines", { year, make, model })
      .then((opts) => {
        if (!live) return;
        setEngines(opts);
      })
      .catch((e: Error) => {
        if (!live) return;
        setEngines([]);
        setError(e.message);
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [year, make, model]);

  function applySaved(idx: string) {
    const v = saved[Number(idx)];
    if (!v?.year || !v.make || !v.model) return;
    setYear(String(v.year));
    setMake(v.make);
    setModel(v.model);
    setEngine("");
  }

  const retry = () => {
    if (busy) return;
    if (year && make && model) {
      setModel((m) => m);
      setBusy("engines");
      setError(null);
      load("engines", { year, make, model })
        .then(setEngines)
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(null));
    } else if (year && make) {
      setBusy("models");
      setError(null);
      load("models", { year, make })
        .then(setModels)
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(null));
    } else if (year) {
      setBusy("makes");
      setError(null);
      load("makes", { year })
        .then(setMakes)
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(null));
    }
  };

  return (
    <div>
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
          setMake("");
          setModel("");
          setEngine("");
          setModels([]);
          setEngines([]);
        }}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <label className="lbl" htmlFor="vehicle_make">
        Make
      </label>
      <select
        className="field"
        id="vehicle_make"
        name="vehicle_make"
        required
        disabled={!year || busy === "makes"}
        value={make}
        onChange={(e) => {
          setMake(e.target.value);
          setModel("");
          setEngine("");
          setEngines([]);
        }}
      >
        <option value="">{busy === "makes" ? "Loading makes…" : "Make"}</option>
        {makes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <label className="lbl" htmlFor="vehicle_model">
        Model
      </label>
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

      <label className="lbl" htmlFor="vehicle_engine">
        Engine size
      </label>
      <select
        className="field"
        id="vehicle_engine"
        name="vehicle_engine"
        required
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
