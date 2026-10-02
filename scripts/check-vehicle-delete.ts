import { vehicleDeleteConfirm, vehicleOnJobsMessage } from "../lib/vehicle-delete";

let failed = 0;
function check(name: string, got: string, want: string) {
  if (got !== want) {
    console.error(`FAIL ${name}: got ${got} want ${want}`);
    failed++;
  }
}

check(
  "confirm with VIN",
  vehicleDeleteConfirm({ year: 2021, make: "Toyota", model: "Corolla", vin: "JTDEAMDE4MJ004861" }),
  "Delete 2021 Toyota Corolla (VIN JTDEAMDE4MJ004861)? This can’t be undone.",
);
check("confirm blank VIN", vehicleDeleteConfirm({ year: 2016, make: "Honda", model: "CR-V", vin: "" }), "Delete 2016 Honda CR-V? This can’t be undone.");
check("confirm whitespace VIN", vehicleDeleteConfirm({ year: 2016, make: "Honda", model: "CR-V", vin: "  " }), "Delete 2016 Honda CR-V? This can’t be undone.");
check("confirm missing VIN", vehicleDeleteConfirm({ year: null, make: "Ford", model: "F-150" }), "Delete Ford F-150? This can’t be undone.");
check("confirm no YMM", vehicleDeleteConfirm({ vin: null }), "Delete Vehicle? This can’t be undone.");

check("1 job", vehicleOnJobsMessage(1), "This vehicle is on 1 job, so it can’t be deleted.");
check("2 jobs", vehicleOnJobsMessage(2), "This vehicle is on 2 jobs, so it can’t be deleted.");
check("11 jobs", vehicleOnJobsMessage(11), "This vehicle is on 11 jobs, so it can’t be deleted.");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("vehicle delete ok");
