import { maxJobsOnDay, parseHours, DEFAULT_HOURS, DEFAULT_BUFFER_MIN } from "../lib/schedule";

const sunClosed = parseHours(DEFAULT_HOURS);
if (maxJobsOnDay(sunClosed, "2026-09-06", 45) !== 0) {
  console.error("FAIL Sunday should be closed", maxJobsOnDay(sunClosed, "2026-09-06", 45));
  process.exit(1);
}
const mon = maxJobsOnDay(sunClosed, "2026-09-07", DEFAULT_BUFFER_MIN);
if (mon < 1) {
  console.error("FAIL Monday should have capacity", mon);
  process.exit(1);
}
console.log("schedule hours ok", { sunday: 0, monday: mon });
