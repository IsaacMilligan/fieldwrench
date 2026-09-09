import { DEFAULT_JOB_TEMPLATES } from "../lib/job-templates";

const oil = DEFAULT_JOB_TEMPLATES.find((t) => t.slug === "oil-change");
const brakes = DEFAULT_JOB_TEMPLATES.find((t) => t.slug === "brakes");
const lights = DEFAULT_JOB_TEMPLATES.find((t) => t.slug === "headlights");
if (oil?.default_labor_cents !== 7000 || oil.price_range_label !== "$110–$145") {
  console.error("FAIL oil anchors", oil);
  process.exit(1);
}
if (brakes?.default_labor_cents !== 17500 || !brakes.price_range_label.includes("$340")) {
  console.error("FAIL brakes anchors", brakes);
  process.exit(1);
}
if (lights?.default_labor_cents !== 7500) {
  console.error("FAIL headlights anchors", lights);
  process.exit(1);
}
console.log("job template anchors ok");
