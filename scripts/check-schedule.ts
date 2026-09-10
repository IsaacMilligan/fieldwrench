import {
  maxJobsOnDay,
  parseHours,
  DEFAULT_HOURS,
  DEFAULT_BUFFER_MIN,
  startTimesForDay,
  bookingDurationMinutes,
  parseServiceDurations,
} from "../lib/schedule";

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

const durs = parseServiceDurations(null);
const oil = bookingDurationMinutes(["oil_change"], durs);
if (oil !== 45) {
  console.error("FAIL oil duration", oil);
  process.exit(1);
}
const oilSlots = startTimesForDay(sunClosed, "2026-09-07", oil, 30);
if (oilSlots[0] !== "08:00") {
  console.error("FAIL first oil slot", oilSlots[0]);
  process.exit(1);
}
const lastOil = oilSlots[oilSlots.length - 1];
if (lastOil !== "16:00") {
  console.error("FAIL last oil slot should fit 45m before 17:00", lastOil);
  process.exit(1);
}
if (startTimesForDay(sunClosed, "2026-09-06", oil, 30).length) {
  console.error("FAIL Sunday should have no start times");
  process.exit(1);
}
const both = bookingDurationMinutes(["oil_change", "brake_job"], durs);
if (both !== 165) {
  console.error("FAIL oil+brakes duration", both);
  process.exit(1);
}
const longSlots = startTimesForDay(sunClosed, "2026-09-07", both, 30);
if (longSlots.includes("16:00") || longSlots[longSlots.length - 1] !== "14:00") {
  console.error("FAIL late slots must disappear for long jobs", longSlots);
  process.exit(1);
}
const custom = parseServiceDurations({ oil_change: 90 });
if (bookingDurationMinutes(["oil_change"], custom) !== 90) {
  console.error("FAIL settings duration override");
  process.exit(1);
}

console.log("schedule hours ok", { sunday: 0, monday: mon, lastOil, lastLong: longSlots[longSlots.length - 1] });
