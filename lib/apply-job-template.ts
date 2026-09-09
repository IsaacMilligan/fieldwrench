import { db, getJobTemplate, getSettings, getShopOilDefault, listCatalogItems } from "./db/queries";
import { oilChargeCents } from "./oil-cost";
import { isOilCategory } from "./catalog";
import { isElectricEngine } from "./vpic";
import { parseServiceIds, servicesToJson, type ServiceId } from "./services";
import { serviceIdForTemplate } from "./job-templates";
import type { CatalogItem } from "./catalog";

export async function applyJobTemplateToJob(opts: {
  shopId: string;
  jobId: string;
  templateId: string;
  mode: "replace" | "merge";
}): Promise<{ oilNeed: boolean; bevBlocked: boolean }> {
  const sql = await db();
  const tmpl = await getJobTemplate(opts.templateId);
  if (!tmpl || !tmpl.active) return { oilNeed: false, bevBlocked: false };

  const [job] = await sql<{ id: string; vehicle_id: string | null; services: string; complaint: string; shop_id: string }[]>`
    SELECT id, vehicle_id, services, complaint, shop_id FROM jobs WHERE id = ${opts.jobId} AND shop_id = ${opts.shopId}
  `;
  if (!job) return { oilNeed: false, bevBlocked: false };

  const [vehicle] = job.vehicle_id
    ? await sql<{ engine: string; oil_qt: number | null; oil_saved: number; oil_viscosity: string; year: number | null; make: string; model: string }[]>`
        SELECT engine, oil_qt, oil_saved, oil_viscosity, year, make, model FROM vehicles WHERE id = ${job.vehicle_id}
      `
    : [];

  if (tmpl.service_type === "oil_change" && vehicle && isElectricEngine(vehicle.engine)) {
    return { oilNeed: false, bevBlocked: true };
  }

  if (opts.mode === "replace") {
    await sql`DELETE FROM labor_lines WHERE job_id = ${opts.jobId}`;
    await sql`DELETE FROM part_lines WHERE job_id = ${opts.jobId}`;
  }

  if (tmpl.default_labor_cents > 0) {
    await sql`INSERT INTO labor_lines (id, job_id, description, hours, rate_cents, is_flat, flat_cents) VALUES (
      ${crypto.randomUUID()}, ${opts.jobId}, ${tmpl.name}, 0, 0, 1, ${tmpl.default_labor_cents}
    )`;
  }

  const catalog = await listCatalogItems();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const settings = await getSettings().catch(() => ({ oil_jug_qt: 5, oil_jug_cents: 0 }));
  let quarts: number | null = null;
  if (vehicle && Number(vehicle.oil_saved) === 1 && Number(vehicle.oil_qt) > 0) {
    quarts = Number(vehicle.oil_qt);
  } else if (vehicle) {
    const shop = await getShopOilDefault({
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      engine: vehicle.engine,
    }).catch(() => null);
    if (shop?.oil_qt && Number(shop.oil_qt) > 0) quarts = Number(shop.oil_qt);
  }
  const vis =
    vehicle && Number(vehicle.oil_saved) === 1 ? String(vehicle.oil_viscosity || "") : "";

  let oilNeed = false;
  for (const ln of tmpl.lines) {
    const cat = ln.catalog_item_id ? byId.get(ln.catalog_item_id) : matchCatalog(catalog, ln.catalog_match || ln.label);
    const isOil = ln.kind === "oil" || (cat && isOilCategory(cat.category));
    if (isOil) {
      if (!(quarts && quarts > 0)) {
        oilNeed = true;
        continue;
      }
      const jugQt = cat && cat.jug_qt > 0 ? cat.jug_qt : Number(settings.oil_jug_qt) || 5;
      const jugCents =
        cat && cat.jug_cents > 0 ? cat.jug_cents : Math.round(Number(settings.oil_jug_cents) || 0);
      const cents = oilChargeCents(jugCents, jugQt, quarts);
      if (!cents) {
        oilNeed = true;
        continue;
      }
      const desc = vis ? `${ln.label} · ${quarts} qt ${vis}` : `${ln.label} · ${quarts} qt`;
      await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES (
        ${crypto.randomUUID()}, ${opts.jobId}, ${desc}, 1, ${cents}, ${cents}
      )`;
      continue;
    }
    const qty = ln.qty || 1;
    if (ln.kind === "checklist") {
      await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES (
        ${crypto.randomUUID()}, ${opts.jobId}, ${ln.label}, ${qty}, 0, 0
      )`;
      continue;
    }
    const cost = cat ? cat.cost_cents : 0;
    const price = cat && cat.price_cents > cat.cost_cents ? cat.price_cents : cost;
    const sell = ln.unit_price_cents != null && ln.unit_price_cents > 0 ? ln.unit_price_cents : price;
    const charged = sell > cost ? sell : cost;
    await sql`INSERT INTO part_lines (id, job_id, description, qty, cost_cents, price_cents) VALUES (
      ${crypto.randomUUID()}, ${opts.jobId}, ${ln.label}, ${qty}, ${cost}, ${charged}
    )`;
  }

  const sid = serviceIdForTemplate(tmpl.service_type);
  const services = parseServiceIds(job.services);
  if (sid && !services.includes(sid)) {
    const next = [...services, sid] as ServiceId[];
    await sql`UPDATE jobs SET services = ${servicesToJson(next)} WHERE id = ${opts.jobId}`;
  }
  if (opts.mode === "replace" || !String(job.complaint || "").trim()) {
    const noteBit = tmpl.notes ? `\n${tmpl.notes}` : "";
    await sql`UPDATE jobs SET complaint = ${`${tmpl.name}${noteBit}`} WHERE id = ${opts.jobId}`;
  }

  return { oilNeed, bevBlocked: false };
}

function matchCatalog(items: CatalogItem[], needle: string): CatalogItem | undefined {
  const n = needle.trim().toLowerCase();
  if (!n) return undefined;
  return items.find((i) => i.name.toLowerCase() === n) || items.find((i) => i.name.toLowerCase().includes(n));
}
