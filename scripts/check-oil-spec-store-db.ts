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
  const { upsertVerifiedOilSpec } = await import("../lib/oil-spec-store");
  const { getShopSpec } = await import("../lib/db/queries");
  const shop = "check";
  const crv = { year: 2016, make: "Honda", model: "CR-V", engine: "" };
  const NOTE = "18 ft-lb (13 mm plug) / 62 ft-lb (16 mm plug)";
  const read = async () => {
    const s = await getShopSpec({ ...crv, shopId: shop });
    return s && { vis: s.oil_viscosity, qt: s.oil_qt, tq: s.oil_drain_tq, note: s.oil_drain_tq_note, alts: s.oil_viscosity_alternates, verified: s.verified };
  };
  try {
    // Vehicle/job form path: no existing row, blank engine, no alternates key (Vera's NO-GO repro).
    const saved = await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, tqNote: NOTE, socketMm: null });
    check("form save, new row, blank engine → inserted", saved?.inserted, true);
    check("form save values", await read(), { vis: "0W-20", qt: 4.4, tq: 29, note: NOTE, alts: [], verified: true });

    await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, visAlternates: ["0w-20", "5W-20", "0W-16"], socketMm: null });
    check("given list drops the preferred grade (SQL)", (await read())?.alts, ["5W-20", "0W-16"]);
    check("note kept when tqNote omitted", (await read())?.note, NOTE);

    await upsertVerifiedOilSpec(shop, crv, { vis: "0W-20", qt: 4.4, tq: 29, tqNote: NOTE, socketMm: null });
    check("form save (key omitted) keeps alternates", (await read())?.alts, ["5W-20", "0W-16"]);

    await upsertVerifiedOilSpec(shop, crv, { vis: "5w-20", qt: 4.4, tq: 29, socketMm: null });
    check("preferred changed → dropped from kept list", (await read())?.alts, ["0W-16"]);

    await upsertVerifiedOilSpec(shop, crv, { vis: "", qt: null, tq: null, socketMm: null, visAlternates: ["5W-20", "0W-20"] }, { keepExisting: true });
    check("import keepExisting: blank vis keeps 5w-20 and drops it from list", await read(), {
      vis: "5w-20", qt: 4.4, tq: 29, note: NOTE, alts: ["0W-20"], verified: true,
    });

    await upsertVerifiedOilSpec(shop, crv, { vis: "5W-20", qt: 4.4, tq: 29, visAlternates: [], socketMm: null });
    check("[] clears", (await read())?.alts, []);
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
