/**
 * DB-backed check of the shared oil spec upsert (vehicle/job "Save oil spec", screenshot import,
 * bot POST) against an in-process PGlite over the wire, with the app's real driver (postgres.js,
 * same prepare/fetch_types settings). Run: npx tsx scripts/check-oil-spec-store-db.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";

const PORT = 54329;
const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;

let failed = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error(`FAIL ${name}: got ${g} want ${w}`);
    failed++;
  } else console.log(`ok   ${name}`);
}

(async () => {
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  process.env.DATABASE_URL = URL;
  // Same driver options as lib/db/index.ts getSql(), minus TLS (local socket) and with one connection.
  (globalThis as unknown as { fwSql: unknown }).fwSql = postgres(URL, {
    ssl: false,
    max: 1,
    prepare: false,
    fetch_types: false,
    onnotice: () => {},
  });
  const { upsertVerifiedOilSpec, clearOilSpec } = await import("../lib/oil-spec-store");
  const { db } = await import("../lib/db/queries");
  const { getShopSpec } = await import("../lib/db/queries");
  const shop = "check";
  const crv = { year: 2016, make: "Honda", model: "CR-V", engine: "" };
  const NOTE = "18 ft-lb (13 mm plug) / 62 ft-lb (16 mm plug)";
  const read = async () => {
    const s = await getShopSpec({ ...crv, shopId: shop });
    return s && { vis: s.oil_viscosity, qt: s.oil_qt, tq: s.oil_drain_tq, note: s.oil_drain_tq_note, alts: s.oil_viscosity_alternates.map((a) => a.grade), verified: s.verified };
  };
  const g = (grade: string, temp: string | null = null) => ({ grade, temp });
  const gs = (...grades: string[]) => grades.map((x) => g(x));
  const full = async () => {
    const s = await getShopSpec({ ...crv, shopId: shop });
    return s && { vis: s.oil_viscosity, temp: s.oil_viscosity_temp, alts: s.oil_viscosity_alternates };
  };
  // Raw columns, as live main (text[]) and this branch (v2) see them.
  const raw = async () => {
    const sql = await db();
    const [r] = await sql<{ t: string[]; v2: unknown; temp: string | null }[]>`
      SELECT to_jsonb(oil_viscosity_alternates) AS t, oil_viscosity_alternates_v2 AS v2, oil_viscosity_temp AS temp
      FROM oil_defaults WHERE shop_id = ${shop} AND model_key = 'crv'`;
    const v2 = Array.isArray(r?.v2) ? (r.v2 as { grade: string; temp: string | null }[]).map((o) => ({ grade: o.grade, temp: o.temp })) : r?.v2;
    return r && { t: r.t, v2, temp: r.temp }; // jsonb sorts object keys; compare in {grade, temp} order
  };
  try {
    // Vehicle/job form path: no existing row, blank engine, no alternates key (Vera's NO-GO repro).
    const saved = await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, tqNote: NOTE, socketMm: null });
    check("form save, new row, blank engine → inserted", saved?.inserted, true);
    check("form save values", await read(), { vis: "0W-20", qt: 4.4, tq: 29, note: NOTE, alts: [], verified: true });

    await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, visAlternates: gs("0w-20", "5W-20", "0W-16"), socketMm: null });
    check("given list drops the preferred grade (SQL)", (await read())?.alts, ["5W-20", "0W-16"]);
    check("note kept when tqNote omitted", (await read())?.note, NOTE);

    await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, tqNote: NOTE, socketMm: null });
    check("form save (key omitted) keeps alternates", (await read())?.alts, ["5W-20", "0W-16"]);

    await upsertVerifiedOilSpec(shop, crv, { vis: "5w-20", qt: 4.4, tq: 29, socketMm: null });
    check("preferred changed → dropped from kept list", (await read())?.alts, ["0W-16"]);

    await upsertVerifiedOilSpec(shop, crv, { vis: "", qt: null, tq: null, socketMm: null, visAlternates: gs("5W-20", "0W-20") }, { keepExisting: true });
    check("import keepExisting: blank vis keeps 5w-20 and drops it from list", await read(), {
      vis: "5w-20", qt: 4.4, tq: 29, note: NOTE, alts: ["0W-20"], verified: true,
    });

    await upsertVerifiedOilSpec(shop, crv, { vis: "5W-20", qt: 4.4, tq: 29, visAlternates: [], socketMm: null });
    check("[] clears", (await read())?.alts, []);

    // ---- Grade temps (additive columns) ----
    const sql = await db();
    // Old row written by live main: text[] only, v2 NULL, no temp.
    await sql`UPDATE oil_defaults SET oil_viscosity_alternates = ARRAY['10W-30','5W-30'], oil_viscosity_alternates_v2 = NULL,
      oil_viscosity_temp = NULL WHERE shop_id = ${shop} AND model_key = 'crv'`;
    check("old text[]-only row reads as objects, temp null", await full(), { vis: "5W-20", temp: null, alts: gs("10W-30", "5W-30") });

    // POST path: objects + primary temp → both columns written.
    await upsertVerifiedOilSpec(shop, crv, {
      vis: "0W-20", qt: 4.4, tq: 29, socketMm: null, visTemp: "above 0°F",
      visAlternates: [g("10W-30", "above 0°F"), g("5W-30"), g("0w-20", "dropped")],
    });
    check("POST save: raw text[] + v2 + temp", await raw(), {
      t: ["10W-30", "5W-30"], v2: [g("10W-30", "above 0°F"), g("5W-30")], temp: "above 0°F",
    });
    check("POST save: read", await full(), { vis: "0W-20", temp: "above 0°F", alts: [g("10W-30", "above 0°F"), g("5W-30")] });

    // Live main (old code) edits text[] only: adds 0W-30 in front, drops 5W-30.
    await sql`UPDATE oil_defaults SET oil_viscosity_alternates = ARRAY['0W-30','10w-30'] WHERE shop_id = ${shop} AND model_key = 'crv'`;
    check("old-code text[] change reconciles (text[] order, temps carried)", (await full())?.alts, [g("0W-30"), g("10w-30", "above 0°F")]);
    // Put v2 back in sync for the next steps.
    await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, socketMm: null, visAlternates: [g("10W-30", "above 0°F"), g("5W-30")] });

    // Form save without temp/alternates keys keeps both.
    await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.5, tq: 29, tqNote: null, socketMm: null });
    check("form save keeps temps + alternates", await full(), { vis: "0W-20", temp: "above 0°F", alts: [g("10W-30", "above 0°F"), g("5W-30")] });
    // Form save changing preferred to 10W-30 drops it from both columns, keeps the rest.
    await upsertVerifiedOilSpec(shop, crv, { vis: "10W-30", qt: 4.5, tq: 29, socketMm: null });
    check("preferred change drops grade in both columns", await raw(), { t: ["5W-30"], v2: [g("5W-30")], temp: "above 0°F" });
    // Form temp field blank → clears primary temp only.
    await upsertVerifiedOilSpec(shop, crv, { vis: "10W-30", qt: 4.5, tq: 29, socketMm: null, visTemp: null });
    check("form blank temp clears temp", (await raw())?.temp, null);
    // Kept v2 that was NULL stays NULL (no write to v2 for old rows on a form save).
    await sql`UPDATE oil_defaults SET oil_viscosity_alternates_v2 = NULL WHERE shop_id = ${shop} AND model_key = 'crv'`;
    await upsertVerifiedOilSpec(shop, crv, { vis: "10W-30", qt: 4.5, tq: 29, socketMm: null, visTemp: "above 10°F" });
    check("form save on old row: v2 stays NULL, reads from text[]", [(await raw())?.v2, (await full())?.alts, (await full())?.temp], [null, gs("5W-30"), "above 10°F"]);
    // Import keepExisting with blank temp keeps temp.
    await upsertVerifiedOilSpec(shop, crv, { vis: "", qt: null, tq: null, socketMm: null, visTemp: null }, { keepExisting: true });
    check("import keepExisting keeps temp", (await raw())?.temp, "above 10°F");

    // All-blank form clear: both temps/alternates columns cleared.
    const spec = await getShopSpec({ ...crv, shopId: shop });
    await clearOilSpec(shop, spec!.id);
    check("blank clear: raw", await raw(), { t: [], v2: [], temp: null });
  } catch (e) {
    console.error("FAIL threw:", e instanceof Error ? e.message : e);
    failed++;
  }
  await (globalThis as unknown as { fwSql: { end: () => Promise<void> } }).fwSql.end();
  await server.stop();
  await pg.close();
  if (failed) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log("oil spec store db ok");
  process.exit(0);
})();
