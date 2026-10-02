import { hasDuplicateVin, normalizeVin } from "../lib/vehicle-vin";

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  if (got !== want) {
    console.error(`FAIL ${name}: got ${got} want ${want}`);
    failed++;
  }
}

const VIN = "JTDEAMDE4MJ004861";
check("normalize trims + uppercases", normalizeVin("  jtdeamde4mj004861 "), VIN);
check("normalize null", normalizeVin(null), "");
check("normalize undefined", normalizeVin(undefined), "");

check("exact dup", hasDuplicateVin(VIN, [VIN]), true);
check("case/space dup", hasDuplicateVin(" jtdeamde4mj004861", ["x", "JTDEAMDE4MJ004861 "]), true);
check("different VIN", hasDuplicateVin(VIN, ["JTDEAMDE4MJ004862"]), false);
check("no vehicles", hasDuplicateVin(VIN, []), false);
check("blank VIN exempt", hasDuplicateVin("", ["", null]), false);
check("whitespace VIN exempt", hasDuplicateVin("   ", ["   "]), false);
check("missing VIN exempt", hasDuplicateVin(undefined, [undefined, ""]), false);
check("existing blank never matches", hasDuplicateVin(VIN, ["", null, undefined]), false);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("vehicle vin ok");
