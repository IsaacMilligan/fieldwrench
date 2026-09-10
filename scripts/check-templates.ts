import { DEFAULT_JOB_TEMPLATES } from "../lib/job-templates";
import { guessCatalogTag, lineLooksLikeLabor } from "../lib/catalog";
import { oilChargeCents } from "../lib/oil-cost";

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
if (guessCatalogTag("5W-30 jug") !== "oil" || guessCatalogTag("Oil filter") !== "part" || guessCatalogTag("Oil change labor") !== "labor") {
  console.error("FAIL catalog tag guess");
  process.exit(1);
}
const fake = [
  { name: "Oil change labor", tag: "labor" as const },
  { name: "Oil filter", tag: "part" as const },
] as import("../lib/catalog").CatalogItem[];
if (!lineLooksLikeLabor("Oil change labor", fake) || lineLooksLikeLabor("Oil filter", fake)) {
  console.error("FAIL lineLooksLikeLabor");
  process.exit(1);
}
if (oilChargeCents(2817, 5, 4.5) !== Math.round((2817 * 4.5) / 5)) {
  console.error("FAIL oil 4.5 qt");
  process.exit(1);
}
console.log("job template anchors ok");
