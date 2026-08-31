import { ensureReady, getSql } from "../lib/db/index.ts";
const run = async () => {
  await ensureReady();
  const sql = getSql();
  const [c] = await sql`SELECT COUNT(*)::int AS n FROM customers`;
  console.log("customers", c.n);
  await sql.end({ timeout: 2 });
};
run();
