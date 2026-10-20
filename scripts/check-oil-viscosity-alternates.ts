import {
  normalizeViscosityAlternates,
  oilSpecFormInput,
  parseViscosityAlternatesInput,
  parseViscosityTempInput,
  reconcileViscosityAlternates,
  viscosityAlternatesOf,
  viscosityAlternatesText,
  viscosityWithTemp,
} from "../lib/oil-specs";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL ${name}: got ${g} want ${w}`);
    failed++;
  } else console.log(`ok   ${name}`);
}

const TYPE_ERR = { error: "oil_viscosity_alternates must be an array." };
const ITEM_ERR = { error: "oil_viscosity_alternates items must be a grade string or {grade, temp}." };
const g = (grade: string, temp: string | null = null) => ({ grade, temp });
const gs = (...grades: string[]) => grades.map((x) => g(x));
const parse = (v: unknown, pref = "5W-30") => parseViscosityAlternatesInput(v, pref);

// Normalization
check("trim + drop blanks", normalizeViscosityAlternates(["  0W-30 ", "", "   ", "10W-30"], "5W-30"), gs("0W-30", "10W-30"));
check("case-insensitive dupes keep first spelling", normalizeViscosityAlternates(["0w-30", "0W-30", " 0W-30 "], "5W-30"), gs("0w-30"));
check("drop equal to preferred (case/trim)", normalizeViscosityAlternates(["5w-30", " 5W-30 ", "0W-30"], " 5W-30 "), gs("0W-30"));
check("blank preferred drops nothing", normalizeViscosityAlternates(["5W-30"], ""), gs("5W-30"));
check("null preferred drops nothing", normalizeViscosityAlternates(["5W-30"], null), gs("5W-30"));
check("order kept", normalizeViscosityAlternates(["10W-40", "0W-30", "5W-40"], "15W-40"), gs("10W-40", "0W-30", "5W-40"));

// Input parsing
check("omitted → keep (undefined)", parse(undefined), { alternates: undefined });
check("null → clear", parse(null), { alternates: [] });
check("[] → clear", parse([]), { alternates: [] });
check("blanks only → clear", parse(["", "  "]), { alternates: [] });
check("only the preferred → clear", parse(["5w-30"]), { alternates: [] });
check("valid list normalized", parse([" 0W-30", "0w-30", "5W-30", "10W-30"]), { alternates: gs("0W-30", "10W-30") });
check("string → 400", parse("0W-30"), TYPE_ERR);
check("number → 400", parse(30), TYPE_ERR);
check("boolean → 400", parse(true), TYPE_ERR);
check("object (not array) → 400", parse({ a: "0W-30" }), TYPE_ERR);
check("array with number → 400", parse(["0W-30", 5]), ITEM_ERR);
check("array with null → 400", parse(["0W-30", null]), ITEM_ERR);
check("nested array → 400", parse([["0W-30"]]), ITEM_ERR);
check("item 20 chars ok", parse(["x".repeat(20)]), { alternates: gs("x".repeat(20)) });
check("item 21 chars → 400", parse(["x".repeat(21)]), { error: "oil_viscosity_alternates grades must be at most 20 characters." });
check("item padded to 21 but 20 trimmed ok", parse([` ${"x".repeat(20)}`]), { alternates: gs("x".repeat(20)) });
const ten = Array.from({ length: 10 }, (_, i) => `${i}W-40`);
check("10 items ok", parse(ten, "15W-40"), { alternates: gs(...ten) });
check("11 items → 400", parse([...ten, "20W-50"], "15W-40"), { error: "oil_viscosity_alternates can have at most 10 items." });
check("11 raw but 10 after dedupe ok", parse([...ten, "0w-40"], "15W-40"), { alternates: gs(...ten) });

// Stored value → API output
check("stored null → []", viscosityAlternatesOf(null), []);
check("stored array", viscosityAlternatesOf(["0W-30", " 10W-30 "]), ["0W-30", "10W-30"]);

// Objects + mixed
check("objects", parse([{ grade: "10W-30", temp: "above 0°F" }, { grade: "5W-40" }]), { alternates: [g("10W-30", "above 0°F"), g("5W-40")] });
check("mixed string + object", parse(["0W-30", { grade: " 10W-30 ", temp: "  above   0°F " }]), { alternates: [g("0W-30"), g("10W-30", "above 0°F")] });
check("object temp null", parse([{ grade: "10W-30", temp: null }]), { alternates: [g("10W-30")] });
check("object temp blank → null", parse([{ grade: "10W-30", temp: "   " }]), { alternates: [g("10W-30")] });
check("object dupe of string keeps first", parse(["10w-30", { grade: "10W-30", temp: "above 0°F" }]), { alternates: [g("10w-30")] });
check("object equal to preferred dropped", parse([{ grade: "5w-30", temp: "x" }, "0W-20"]), { alternates: [g("0W-20")] });
check("object without grade → 400", parse([{ temp: "above 0°F" }]), ITEM_ERR);
check("object blank grade → 400", parse([{ grade: "  " }]), ITEM_ERR);
check("object number grade → 400", parse([{ grade: 30 }]), ITEM_ERR);
check("object number temp → 400", parse([{ grade: "10W-30", temp: 0 }]), { error: "oil_viscosity_alternates temp must be text." });
check("object temp 40 ok", parse([{ grade: "10W-30", temp: "t".repeat(40) }]), { alternates: [g("10W-30", "t".repeat(40))] });
check("object temp 41 → 400", parse([{ grade: "10W-30", temp: "t".repeat(41) }]), { error: "oil_viscosity_alternates temp is too long (max 40)." });
check("object grade 21 → 400", parse([{ grade: "x".repeat(21) }]), { error: "oil_viscosity_alternates grades must be at most 20 characters." });

// oil_viscosity_temp
check("temp omitted → keep", parseViscosityTempInput(undefined), { temp: undefined });
check("temp null → clear", parseViscosityTempInput(null), { temp: null });
check("temp '' → clear", parseViscosityTempInput(""), { temp: null });
check("temp trimmed", parseViscosityTempInput("  above  0°F "), { temp: "above 0°F" });
check("temp number → 400", parseViscosityTempInput(0), { error: "oil_viscosity_temp must be text." });
check("temp object → 400", parseViscosityTempInput({}), { error: "oil_viscosity_temp must be text." });
check("temp 40 ok", parseViscosityTempInput("t".repeat(40)), { temp: "t".repeat(40) });
check("temp 41 → 400", parseViscosityTempInput("t".repeat(41)), { error: "oil_viscosity_temp is too long (max 40)." });

// Reconcile text[] (authoritative grades + order) with v2 (temps)
check("v2 NULL → from text[], temps null", reconcileViscosityAlternates(["10W-30", "5W-30"], null), gs("10W-30", "5W-30"));
check("both empty", reconcileViscosityAlternates([], []), []);
check("text[] null + v2 null", reconcileViscosityAlternates(null, null), []);
check("same set → v2 as is", reconcileViscosityAlternates(["10W-30", "5W-30"], [g("10W-30", "above 0°F"), g("5W-30")]), [g("10W-30", "above 0°F"), g("5W-30")]);
check("same set, case differs → v2", reconcileViscosityAlternates(["10w-30"], [g("10W-30", "above 0°F")]), [g("10W-30", "above 0°F")]);
check("old code added a grade → text[] order, temps carried", reconcileViscosityAlternates(["0W-30", "10W-30"], [g("10W-30", "above 0°F")]), [g("0W-30"), g("10W-30", "above 0°F")]);
check("old code removed a grade", reconcileViscosityAlternates(["5W-30"], [g("10W-30", "above 0°F"), g("5W-30", "-20°F+")]), [g("5W-30", "-20°F+")]);
check("old code cleared → []", reconcileViscosityAlternates([], [g("10W-30", "above 0°F")]), []);
check("v2 [] but text[] has grades", reconcileViscosityAlternates(["10W-30"], []), gs("10W-30"));
check("v2 tolerates strings", reconcileViscosityAlternates(["10W-30"], ["10W-30"]), gs("10W-30"));

// Display
check("primary with temp", viscosityWithTemp("0W-20", "above 0°F"), "0W-20 · above 0°F");
check("primary no temp unchanged", viscosityWithTemp("0W-20", null), "0W-20");
check("temp but no grade", viscosityWithTemp("", "above 0°F"), "");
check("also OK text", viscosityAlternatesText([g("10W-30", "above 0°F"), g("5W-30")]), "10W-30 (above 0°F), 5W-30");
check("also OK empty", viscosityAlternatesText([]), "");

// Save oil spec form: temp field
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
check("form without temp field → keep", oilSpecFormInput(fd({ oil_viscosity: "0W-20" })).visTemp, undefined);
check("form blank temp → clear", oilSpecFormInput(fd({ oil_viscosity: "0W-20", oil_viscosity_temp: " " })).visTemp, null);
check("form temp", oilSpecFormInput(fd({ oil_viscosity: "0W-20", oil_viscosity_temp: " above 0°F " })).visTemp, "above 0°F");
check("form all blank incl temp → blank", oilSpecFormInput(fd({ oil_viscosity: "", oil_viscosity_temp: "" })).blank, true);
check("form temp only → not blank", oilSpecFormInput(fd({ oil_viscosity_temp: "above 0°F" })).blank, false);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("oil viscosity alternates ok");
