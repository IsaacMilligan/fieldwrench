import bcrypt from "bcryptjs";
import type { Sql } from "./index";
import { denverDateISO } from "../format";
import { DEMO_EMAIL, DEMO_SHOP_ID } from "../shop";
import { DEFAULT_CATALOG } from "../catalog";

const DEMO_PASSWORD = "driveway";

function id(): string {
  return crypto.randomUUID();
}

function token(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

function daysFromToday(offset: number): string {
  const [y, m, d] = denverDateISO().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset, 18, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export async function wipeAll(sql: Sql) {
  await wipeDemo(sql);
}

async function wipeDemo(sql: Sql) {
  await sql`DELETE FROM job_discounts WHERE job_id IN (SELECT id FROM jobs WHERE shop_id = ${DEMO_SHOP_ID})`;
  await sql`DELETE FROM discount_presets WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM catalog_items WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM photos WHERE job_id IN (SELECT id FROM jobs WHERE shop_id = ${DEMO_SHOP_ID})`;
  await sql`DELETE FROM labor_lines WHERE job_id IN (SELECT id FROM jobs WHERE shop_id = ${DEMO_SHOP_ID})`;
  await sql`DELETE FROM part_lines WHERE job_id IN (SELECT id FROM jobs WHERE shop_id = ${DEMO_SHOP_ID})`;
  await sql`DELETE FROM invoices WHERE job_id IN (SELECT id FROM jobs WHERE shop_id = ${DEMO_SHOP_ID})`;
  await sql`DELETE FROM receipts WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM mileage_trips WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM bookings WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM jobs WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM vehicles WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM customers WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM oil_defaults WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM users WHERE shop_id = ${DEMO_SHOP_ID}`;
  await sql`DELETE FROM settings WHERE shop_id = ${DEMO_SHOP_ID}`;
}

export async function seedIfEmpty(sql: Sql) {
  const [owner] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users WHERE is_demo = 0`;
  const [demo] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users WHERE email = ${DEMO_EMAIL}`;
  if (!demo?.n) await seedDemo(sql);
  if (owner?.n) return;
}

export async function seedDemo(sql: Sql) {
  await wipeDemo(sql);
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  await sql`INSERT INTO users (id, email, password_hash, name, shop_id, is_demo) VALUES (${id()}, ${DEMO_EMAIL}, ${hash}, 'Demo mechanic', ${DEMO_SHOP_ID}, 1)`;
  await sql`
    INSERT INTO settings (id, shop_name, labor_rate_cents, mileage_rate_cents, lead_hours, theme, seeded, shop_id)
    VALUES (1, 'FieldWrench', 12500, 76, 24, 'light', 1, ${DEMO_SHOP_ID})
  `;
  for (const item of DEFAULT_CATALOG) {
    await sql`INSERT INTO catalog_items (id, shop_id, name, category, cost_cents, price_cents, jug_qt, jug_cents)
      VALUES (${id()}, ${DEMO_SHOP_ID}, ${item.name}, ${item.category}, 0, 0, 5, 0)`;
  }

  const mara = id();
  const devon = id();
  const priya = id();
  await sql`INSERT INTO customers (id, name, phone, email, address, notes, shop_id) VALUES
    (${mara}, 'Mara Ellison', '385-555-0142', 'mara.ellison@example.com', '4124 Pinnacle Peak Dr, Eagle Mountain, UT', 'Prefers morning windows. Park on the right side of the driveway.', ${DEMO_SHOP_ID}),
    (${devon}, 'Devon Ruiz', '801-555-0198', 'devon.ruiz@example.com', '1887 Harvest Field Rd, Saratoga Springs, UT', 'Needs a driveway or private lot — no street work.', ${DEMO_SHOP_ID}),
    (${priya}, 'Priya Nandakumar', '385-555-0117', 'priya.n@example.com', '902 Pioneer Crossing, Lehi, UT', 'Work van on site weekdays after 4.', ${DEMO_SHOP_ID})
  `;

  const crv = id();
  const outback = id();
  const f150 = id();
  const camry = id();
  await sql`INSERT INTO vehicles (id, customer_id, year, make, model, plate, vin, mileage, history_notes, shop_id) VALUES
    (${crv}, ${mara}, 2016, 'Honda', 'CR-V', 'X7R 241', '2HKRM4H75GH123456', 118402, 'Rear pads done last fall. Customer reports a faint grind only when cold.', ${DEMO_SHOP_ID}),
    (${outback}, ${mara}, 2014, 'Subaru', 'Outback', 'U24 880', '4S4BSACC5E1234567', 164110, 'Battery was original until this year. Occasional slow crank after sitting.', ${DEMO_SHOP_ID}),
    (${f150}, ${devon}, 2019, 'Ford', 'F-150', 'Z19 004', '1FTEW1E49KFA12345', 87220, 'Tows a small utility trailer on weekends. Front brakes pulse on I-15.', ${DEMO_SHOP_ID}),
    (${camry}, ${priya}, 2021, 'Toyota', 'Camry', 'N5P 773', '4T1G11AK5MU123456', 41280, 'P0302 stored last winter. Coil pack on cylinder 2 was noisy.', ${DEMO_SHOP_ID})
  `;

  const jOil = id();
  const jBrakes = id();
  const jMisfire = id();
  const jBattery = id();
  const jCabin = id();
  const jPads = id();

  const today = denverDateISO();
  const tMorning = `${today}T14:00:00.000Z`; // 8am MDT
  const tNow = `${today}T16:30:00.000Z`;

  await sql`INSERT INTO jobs (id, customer_id, vehicle_id, status, scheduled_at, address, complaint, diagnosis, work_performed, created_at, shop_id) VALUES
    (${jOil}, ${mara}, ${crv}, 'scheduled', ${tMorning}, '4124 Pinnacle Peak Dr, Eagle Mountain, UT',
      'Due for oil. Slight tick on cold start.', '', '', NOW(), ${DEMO_SHOP_ID}),
    (${jBrakes}, ${devon}, ${f150}, 'in_progress', ${tNow}, '1887 Harvest Field Rd, Saratoga Springs, UT',
      'Steering wheel shakes under braking from 70 mph.',
      'Front rotors have 0.004 in runout. Pads at 3 mm.',
      'Passenger rotor off. Cleaning hub face.', NOW(), ${DEMO_SHOP_ID}),
    (${jMisfire}, ${priya}, ${camry}, 'waiting_parts', ${(daysFromToday(-1) + "T17:00:00.000Z")},
      '902 Pioneer Crossing, Lehi, UT',
      'Rough idle, flashing MIL, feels like a misfire in gear.',
      'P0302 confirmed. Coil 2 secondary looks weak on scope.',
      'Ordered OEM coil and iridium plug. Waiting on overnight.', NOW(), ${DEMO_SHOP_ID}),
    (${jBattery}, ${mara}, ${outback}, 'completed', ${(daysFromToday(-1) + "T15:00:00.000Z")},
      '4124 Pinnacle Peak Dr, Eagle Mountain, UT',
      'Slow crank after sitting overnight. Headlights dip at start.',
      'Battery 11.8 V resting. Failed load test.',
      'Installed Group 35 AGM. Cleaned terminals. 14.5 V running.', NOW(), ${DEMO_SHOP_ID}),
    (${jCabin}, ${devon}, ${f150}, 'completed', ${(daysFromToday(-4) + "T16:00:00.000Z")},
      '1887 Harvest Field Rd, Saratoga Springs, UT',
      'Musty AC smell and overdue oil.',
      'Cabin filter soaked. Oil black at 8,200 since last change.',
      'Oil, filter, cabin filter. Cleared drain. Rechecked for leaks.', NOW(), ${DEMO_SHOP_ID}),
    (${jPads}, ${mara}, ${crv}, 'completed', ${(daysFromToday(-10) + "T15:30:00.000Z")},
      '4124 Pinnacle Peak Dr, Eagle Mountain, UT',
      'Rear squeal at low speed.',
      'Rear pads on wear indicators. Hardware rusty.',
      'Rear pads and hardware. Lubed slides. Bedded on the street.', NOW(), ${DEMO_SHOP_ID})
  `;

  const rate = 12500;
  await sql`INSERT INTO labor_lines (id, job_id, description, hours, rate_cents, is_flat, flat_cents) VALUES
    (${id()}, ${jOil}, 'Oil + filter in driveway', 0, ${rate}, 1, 8500),
    (${id()}, ${jBrakes}, 'Front brake job — rotors and pads', 2.5, ${rate}, 0, 0),
    (${id()}, ${jMisfire}, 'Diagnose misfire + coil R&R', 1.2, ${rate}, 0, 0),
    (${id()}, ${jBattery}, 'Test and replace battery', 0, ${rate}, 1, 6500),
    (${id()}, ${jCabin}, 'Oil service + cabin filter', 0, ${rate}, 1, 11000),
    (${id()}, ${jPads}, 'Rear pads and hardware', 1.5, ${rate}, 0, 0)
  `;

  await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES
    (${id()}, ${jOil}, '5W-30 5 qt + Honda filter', 1, 2800, 5200),
    (${id()}, ${jBrakes}, 'Front rotor pair', 1, 8400, 14800),
    (${id()}, ${jBrakes}, 'Ceramic pad set', 1, 3900, 7800),
    (${id()}, ${jMisfire}, 'OEM ignition coil', 1, 6700, 12400),
    (${id()}, ${jMisfire}, 'Iridium spark plug', 1, 900, 1800),
    (${id()}, ${jBattery}, 'Group 35 AGM battery', 1, 14200, 21900),
    (${id()}, ${jCabin}, 'Oil filter + 5W-20 6 qt', 1, 3100, 5800),
    (${id()}, ${jCabin}, 'Cabin filter', 1, 1100, 2800),
    (${id()}, ${jPads}, 'Rear ceramic pads + hardware', 1, 4200, 8600)
  `;

  await sql`INSERT INTO invoices (id, job_id, token, status, paid_method, paid_at) VALUES
    (${id()}, ${jBattery}, ${token()}, 'unpaid', NULL, NULL),
    (${id()}, ${jCabin}, ${token()}, 'unpaid', NULL, NULL),
    (${id()}, ${jPads}, ${token()}, 'paid', 'venmo', ${(daysFromToday(-9) + "T22:00:00.000Z")})
  `;

  await sql`INSERT INTO receipts (id, amount_cents, vendor, category, date, job_id) VALUES
    (${id()}, 8400, 'AutoZone', 'parts', ${daysFromToday(-1)}, ${jBrakes}),
    (${id()}, 6700, 'RockAuto', 'parts', ${daysFromToday(-2)}, ${jMisfire}),
    (${id()}, 1800, 'Harbor Freight', 'shop', ${daysFromToday(-6)}, NULL),
    (${id()}, 4200, 'O''Reilly', 'parts', ${daysFromToday(-10)}, ${jPads}),
    (${id()}, 2400, 'Costco', 'fuel', ${daysFromToday(-3)}, NULL)
  `;

  await sql`INSERT INTO mileage_trips (id, miles, purpose, job_id, date) VALUES
    (${id()}, 18.4, 'Driveway call — Ellison CR-V', ${jOil}, ${today}),
    (${id()}, 22.1, 'Driveway call — Ruiz F-150 brakes', ${jBrakes}, ${today}),
    (${id()}, 31.0, 'Lehi misfire diagnosis', ${jMisfire}, ${daysFromToday(-1)}),
    (${id()}, 14.2, 'Parts run — rotors', ${jBrakes}, ${daysFromToday(-1)}),
    (${id()}, 19.6, 'Battery swap — Outback', ${jBattery}, ${daysFromToday(-1)}),
    (${id()}, 41.5, 'Weekender parts + two quotes', NULL, ${daysFromToday(-8)}),
    (${id()}, 28.0, 'Rear pads — Ellison', ${jPads}, ${daysFromToday(-10)}),
    (${id()}, 36.8, 'YTD catch-up shop miles', NULL, ${daysFromToday(-40)})
  `;

  await sql`INSERT INTO bookings (id, name, phone, address, vehicle, issue, preferred_time, status) VALUES
    (${id()}, 'Chris Lang', '801-555-0164', '55 Cedar Pass Ct, Eagle Mountain, UT',
     '2018 Chevy Equinox', 'Grinding from the passenger front at low speed. Worse in reverse.',
     'Saturday morning', 'pending')
  `;
}
