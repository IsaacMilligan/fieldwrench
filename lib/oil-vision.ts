import sharp from "sharp";
import { positiveNum } from "@/lib/oil-specs";

/**
 * O'Reilly Pro screenshot → oil spec fields, via a vision model with strict JSON output.
 * Server-only. This module NEVER touches the database: extraction is read-only and the
 * user must confirm + Save (separate endpoint) before anything is written.
 */

export const OIL_SHOT_MAX_BYTES = 8 * 1024 * 1024;
/** Primary env var named in the "not configured" message. */
export const OIL_VISION_PRIMARY_VAR = "OPENAI_API_KEY";

type Provider = { name: "openai" | "xai"; keyVar: string; key: string; baseUrl: string; model: string };

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

/** OpenAI (preferred) or xAI, whichever key is set. OIL_VISION_PROVIDER forces one. */
export function visionProvider(): Provider | null {
  const forced = env("OIL_VISION_PROVIDER").toLowerCase();
  const model = env("OIL_VISION_MODEL");
  const openai = (): Provider | null =>
    env("OPENAI_API_KEY")
      ? {
          name: "openai",
          keyVar: "OPENAI_API_KEY",
          key: env("OPENAI_API_KEY"),
          baseUrl: "https://api.openai.com/v1",
          model: model || "gpt-4.1-mini",
        }
      : null;
  const xai = (): Provider | null =>
    env("XAI_API_KEY")
      ? {
          name: "xai",
          keyVar: "XAI_API_KEY",
          key: env("XAI_API_KEY"),
          baseUrl: "https://api.x.ai/v1",
          model: model || "grok-4.7",
        }
      : null;
  if (forced === "openai") return openai();
  if (forced === "xai") return xai();
  return openai() ?? xai();
}

export function visionNotConfiguredMessage(): string {
  return `Screenshot import needs ${OIL_VISION_PRIMARY_VAR} set`;
}

export class OilShotError extends Error {
  constructor(
    message: string,
    public code: "not_configured" | "bad_image" | "too_large" | "model_failed" | "not_spec",
    public status = 400,
  ) {
    super(message);
  }
}

function looksHeic(type: string, name: string, buf: Uint8Array): boolean {
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif")) return true;
  if (buf.length >= 12) {
    const brand = Buffer.from(buf.subarray(4, 12)).toString("ascii");
    if (brand.startsWith("ftyp") && /heic|heif|mif1|msf1/i.test(brand)) return true;
  }
  return false;
}

/**
 * Server-side upload validation: must decode as a real image (not just an image/* MIME),
 * ≤ 8 MB. Normalized to a JPEG sized for legible text before it goes to the model.
 */
export async function prepareOilShot(file: unknown): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new OilShotError("Pick or paste a screenshot first.", "bad_image");
  }
  if (file.size > OIL_SHOT_MAX_BYTES) {
    throw new OilShotError("Screenshot is over 8 MB. Crop it to the oil spec section.", "too_large", 413);
  }
  const mime = (file.type || "").toLowerCase();
  const input = Buffer.from(await file.arrayBuffer());
  const heic = looksHeic(mime, file.name || "", input);
  if (!heic && !mime.startsWith("image/")) {
    throw new OilShotError("That file is not an image. Use a PNG or JPEG screenshot.", "bad_image", 415);
  }
  let work: Uint8Array = input;
  if (heic) {
    try {
      const convert = (await import("heic-convert")).default;
      work = new Uint8Array(await convert({ buffer: input, format: "JPEG", quality: 0.9 }));
    } catch {
      throw new OilShotError("Could not read that iPhone image. Take a regular screenshot instead.", "bad_image", 415);
    }
  }
  try {
    const img = sharp(work, { limitInputPixels: 60_000_000 });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error("no size");
    const jpeg = await img
      .rotate()
      .resize({ width: 1800, height: 4200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    throw new OilShotError("Could not read that image. Use a PNG or JPEG screenshot.", "bad_image", 415);
  }
}

export type OilShotFields = {
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  viscosity: string | null;
  qtWithFilter: number | null;
  drainTq: number | null;
  socketMm: number | null;
};

const PROMPT = `You read screenshots of O'Reilly Pro (oreillypro.com) vehicle specification pages for a mechanic.
Extract ONLY what is printed clearly in the image. NEVER guess, infer, look up, convert units, or use your own knowledge of the vehicle.
Return null for any field that is not clearly legible, is cut off, is ambiguous (for example several engines or several different values and you cannot tell which applies), or is not on the page.

Fields:
- is_spec_page: true only if the image shows an automotive specification page with engine oil information (viscosity, capacity, or drain plug). Otherwise false and every other field null.
- year, make, model, engine: the vehicle the page is for, exactly as printed (engine like "2.5L L4" or "5.3L V8"). null if not shown.
- viscosity: engine oil viscosity grade as printed, e.g. "0W-20". If several grades are listed without a clear primary one, null.
- capacity_qt_with_filter: engine oil capacity WITH filter change, in US quarts, only if the page states quarts. If the page shows only liters, or does not say it includes the filter, null.
- drain_plug_torque_ft_lb: oil drain plug torque, only if stated in ft-lb (or lb-ft / ft. lbs). If only N·m or in-lb is shown, null. If a range is shown, null.
- drain_plug_socket_mm: drain plug wrench/socket size in millimeters, only if stated in mm. Otherwise null.
- unreadable_notes: short note of anything you saw but could not read confidently, or null.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_spec_page",
    "year",
    "make",
    "model",
    "engine",
    "viscosity",
    "capacity_qt_with_filter",
    "drain_plug_torque_ft_lb",
    "drain_plug_socket_mm",
    "unreadable_notes",
  ],
  properties: {
    is_spec_page: { type: "boolean" },
    year: { type: ["integer", "null"] },
    make: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    engine: { type: ["string", "null"] },
    viscosity: { type: ["string", "null"] },
    capacity_qt_with_filter: { type: ["number", "null"] },
    drain_plug_torque_ft_lb: { type: ["number", "null"] },
    drain_plug_socket_mm: { type: ["number", "null"] },
    unreadable_notes: { type: ["string", "null"] },
  },
} as const;

function cleanText(v: unknown, max = 60): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t || t.length > max || /^(n\/?a|null|none|unknown|-+)$/i.test(t)) return null;
  return t;
}

function inRange(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : positiveNum(v);
  if (n == null || !Number.isFinite(n) || n < lo || n > hi) return null;
  return Math.round(n * 100) / 100;
}

/** "SAE 0w20" → "0W-20". Anything that is not a single clear grade → null. */
export function normalizeViscosity(v: unknown): string | null {
  const t = cleanText(v, 40);
  if (!t) return null;
  const all = t.toUpperCase().match(/\b\d{1,2}\s*W\s*-?\s*\d{1,2}\b/g);
  if (!all || all.length !== 1) return null;
  const m = all[0].replace(/\s+/g, "").match(/^(\d{1,2})W-?(\d{1,2})$/);
  return m ? `${Number(m[1])}W-${Number(m[2])}` : null;
}

/** Strict validation of the model's JSON. Anything implausible becomes null (blank). */
export function sanitizeOilShot(raw: unknown): { isSpec: boolean; fields: OilShotFields; notes: string | null } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const maxYear = new Date().getFullYear() + 2;
  const year = inRange(r.year, 1980, maxYear);
  const fields: OilShotFields = {
    year: year != null && Number.isInteger(year) ? year : null,
    make: cleanText(r.make, 40),
    model: cleanText(r.model, 60),
    engine: cleanText(r.engine, 60),
    viscosity: normalizeViscosity(r.viscosity),
    qtWithFilter: inRange(r.capacity_qt_with_filter, 1, 20),
    drainTq: inRange(r.drain_plug_torque_ft_lb, 3, 100),
    socketMm: inRange(r.drain_plug_socket_mm, 6, 36),
  };
  const oilAny = Boolean(fields.viscosity || fields.qtWithFilter || fields.drainTq || fields.socketMm);
  return { isSpec: r.is_spec_page === true && oilAny, fields, notes: cleanText(r.unreadable_notes, 240) };
}

/** Calls the vision model. Throws OilShotError with a user-facing message on any failure. */
export async function extractOilShot(dataUrl: string): Promise<{
  fields: OilShotFields;
  notes: string | null;
  provider: string;
  model: string;
}> {
  const p = visionProvider();
  if (!p) throw new OilShotError(visionNotConfiguredMessage(), "not_configured", 503);
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: p.model,
        temperature: 0,
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the oil spec fields from this screenshot. null for anything not clearly legible." },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "oil_spec_screenshot", strict: true, schema: SCHEMA },
        },
      }),
    });
  } catch (e) {
    console.error("oil_shot model fetch", p.name, e instanceof Error ? e.message : e);
    throw new OilShotError("The screenshot reader did not answer. Try again, or type the spec in below.", "model_failed", 502);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("oil_shot model http", p.name, p.model, res.status, body.slice(0, 300));
    const msg =
      res.status === 401 || res.status === 403
        ? `Screenshot reader rejected the API key (${p.keyVar}). Type the spec in below.`
        : "The screenshot reader failed. Try again, or type the spec in below.";
    throw new OilShotError(msg, "model_failed", 502);
  }
  const json = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  } | null;
  const content = json?.choices?.[0]?.message?.content;
  let parsed: unknown = null;
  try {
    parsed = content ? JSON.parse(content) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    console.error("oil_shot model bad json", p.name, String(content ?? "").slice(0, 200));
    throw new OilShotError("Could not read that screenshot. Try again, or type the spec in below.", "model_failed", 502);
  }
  const out = sanitizeOilShot(parsed);
  if (!out.isSpec) {
    throw new OilShotError(
      "No oil spec found in that image. Screenshot the O'Reilly Pro oil/fluids spec section, or type it in below.",
      "not_spec",
      422,
    );
  }
  return { fields: out.fields, notes: out.notes, provider: p.name, model: p.model };
}
