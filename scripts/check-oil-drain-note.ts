import { cleanDrainTqNote, drainTqText, parseDrainTqNoteInput, oilSpecComplete, oilSpecHasAny, oilYmmeKey, pickVerifiedOilRow } from "../lib/oil-specs";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  if (got !== want) {
    console.error(`FAIL ${name}: got ${got} want ${want}`);
    failed++;
  } else console.log(`ok   ${name}`);
}

const NOTE = "18 ft-lb (13 mm plug) / 62 ft-lb (16 mm plug)";
check("clean trims/collapses", cleanDrainTqNote(`  18 ft-lb (13 mm plug)\n /  62 ft-lb (16 mm plug) `), "18 ft-lb (13 mm plug) / 62 ft-lb (16 mm plug)");
check("clean blank → null", cleanDrainTqNote("   "), null);
check("clean null → null", cleanDrainTqNote(null), null);

check("text: note wins", drainTqText({ drainTq: 18, drainTqNote: NOTE }), NOTE);
check("text: number only", drainTqText({ drainTq: 18, drainTqNote: null }), "18 ft-lb");
check("text: missing note key", drainTqText({ drainTq: 25.5 }), "25.5 ft-lb");
check("text: blank note falls back", drainTqText({ drainTq: 18, drainTqNote: " " }), "18 ft-lb");
check("text: nothing", drainTqText({ drainTq: null, drainTqNote: null }), "");

// API input (POST /api/oil/specs): non-strings → 400.
const TEXT_ERR = "oil_drain_tq_note must be text.";
const err = (v: unknown) => { const r = parseDrainTqNoteInput(v); return "error" in r ? r.error : `note=${JSON.stringify(r.note)}`; };
const note = (v: unknown) => { const r = parseDrainTqNoteInput(v); return "note" in r ? r.note : `error=${r.error}`; };
check("input number → 400", err(123), TEXT_ERR);
check("input 0 → 400", err(0), TEXT_ERR);
check("input boolean → 400", err(true), TEXT_ERR);
check("input false → 400", err(false), TEXT_ERR);
check("input object → 400", err({ a: 1 }), TEXT_ERR);
check("input array → 400", err(["18 ft-lb"]), TEXT_ERR);
check("input too long → 400", err("x".repeat(201)), "oil_drain_tq_note is too long (max 200).");
check("input 200 chars ok", note("x".repeat(200)), "x".repeat(200));
check("input omitted keeps", note(undefined), undefined);
check("input null clears", note(null), null);
check("input empty clears", note(""), null);
check("input spaces clears", note("   "), null);
check("input string cleaned", note(`  ${NOTE}  `), NOTE);

const base = { viscosity: "15W-40", qtWithFilter: 10, drainTq: null, socketMm: null };
check("complete with note, no number", oilSpecComplete({ ...base, drainTqNote: NOTE }), true);
check("incomplete without tq/note", oilSpecComplete(base), false);
check("hasAny note only", oilSpecHasAny({ viscosity: "", qtWithFilter: null, drainTq: null, drainTqNote: NOTE, socketMm: null }), true);

// Two same-displacement rows that differ only by note → no guess.
const k = (engine: string) => oilYmmeKey(2002, "Chevrolet", "Silverado 2500", engine)!;
const row = (engine: string, note: string | null) => ({
  model_key: k(engine).model_key, engine_key: k(engine).engine_key, engine_label: engine,
  oil_viscosity: "15W-40", oil_qt: 10, oil_drain_tq: null, oil_drain_tq_note: note,
});
const q = { year: 2002, make: "Chevrolet", model: "Silverado 2500", engine: "6.6L" };
check("displacement: same note picks", pickVerifiedOilRow([row("6.6L V8 Diesel", NOTE), row("6.6L V8 Turbo Diesel", NOTE)], q)?.match, "displacement");
check("displacement: different note no pick", pickVerifiedOilRow([row("6.6L V8 Diesel", NOTE), row("6.6L V8 Turbo Diesel", null)], q), null);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("oil drain note ok");
