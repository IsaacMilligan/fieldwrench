import { normalizeViscosityAlternates, parseViscosityAlternatesInput, viscosityAlternatesOf } from "../lib/oil-specs";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL ${name}: got ${g} want ${w}`);
    failed++;
  } else console.log(`ok   ${name}`);
}

const TYPE_ERR = { error: "oil_viscosity_alternates must be an array of text." };
const parse = (v: unknown, pref = "5W-30") => parseViscosityAlternatesInput(v, pref);

// Normalization
check("trim + drop blanks", normalizeViscosityAlternates(["  0W-30 ", "", "   ", "10W-30"], "5W-30"), ["0W-30", "10W-30"]);
check("case-insensitive dupes keep first spelling", normalizeViscosityAlternates(["0w-30", "0W-30", " 0W-30 "], "5W-30"), ["0w-30"]);
check("drop equal to preferred (case/trim)", normalizeViscosityAlternates(["5w-30", " 5W-30 ", "0W-30"], " 5W-30 "), ["0W-30"]);
check("blank preferred drops nothing", normalizeViscosityAlternates(["5W-30"], ""), ["5W-30"]);
check("null preferred drops nothing", normalizeViscosityAlternates(["5W-30"], null), ["5W-30"]);
check("order kept", normalizeViscosityAlternates(["10W-40", "0W-30", "5W-40"], "15W-40"), ["10W-40", "0W-30", "5W-40"]);

// Input parsing
check("omitted → keep (undefined)", parse(undefined), { alternates: undefined });
check("null → clear", parse(null), { alternates: [] });
check("[] → clear", parse([]), { alternates: [] });
check("blanks only → clear", parse(["", "  "]), { alternates: [] });
check("only the preferred → clear", parse(["5w-30"]), { alternates: [] });
check("valid list normalized", parse([" 0W-30", "0w-30", "5W-30", "10W-30"]), { alternates: ["0W-30", "10W-30"] });
check("string → 400", parse("0W-30"), TYPE_ERR);
check("number → 400", parse(30), TYPE_ERR);
check("boolean → 400", parse(true), TYPE_ERR);
check("object → 400", parse({ a: "0W-30" }), TYPE_ERR);
check("array with number → 400", parse(["0W-30", 5]), TYPE_ERR);
check("array with null → 400", parse(["0W-30", null]), TYPE_ERR);
check("nested array → 400", parse([["0W-30"]]), TYPE_ERR);
check("item 20 chars ok", parse(["x".repeat(20)]), { alternates: ["x".repeat(20)] });
check("item 21 chars → 400", parse(["x".repeat(21)]), { error: "oil_viscosity_alternates items must be at most 20 characters." });
check("item padded to 21 but 20 trimmed ok", parse([` ${"x".repeat(20)}`]), { alternates: ["x".repeat(20)] });
const ten = Array.from({ length: 10 }, (_, i) => `${i}W-40`);
check("10 items ok", parse(ten, "15W-40"), { alternates: ten });
check("11 items → 400", parse([...ten, "20W-50"], "15W-40"), { error: "oil_viscosity_alternates can have at most 10 items." });
check("11 raw but 10 after dedupe ok", parse([...ten, "0w-40"], "15W-40"), { alternates: ten });

// Stored value → API output
check("stored null → []", viscosityAlternatesOf(null), []);
check("stored array", viscosityAlternatesOf(["0W-30", " 10W-30 "]), ["0W-30", "10W-30"]);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("oil viscosity alternates ok");
