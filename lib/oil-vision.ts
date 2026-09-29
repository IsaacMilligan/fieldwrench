import sharp from "sharp";
import { positiveNum } from "@/lib/oil-specs";

/**
 * O'Reilly Pro screenshot → oil spec fields, via a vision model with strict JSON output.
 * Server-only. This module NEVER touches the database: extraction is read-only and the
 * user must confirm + Save (separate endpoint) before anything is written.
 */

export const OIL_SHOT_MAX_BYTES = 8 * 1024 * 1024;
/** O'Reilly Pro puts each spec on its own screen, so one import takes several screenshots. */
export const OIL_SHOT_MAX_IMAGES = 6;
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
    public code: "not_configured" | "bad_image" | "too_large" | "too_many" | "model_failed",
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
export async function prepareOilShot(file: unknown, n = 1): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new OilShotError("Pick or paste a screenshot first.", "bad_image");
  }
  if (file.size > OIL_SHOT_MAX_BYTES) {
    throw new OilShotError(`Image ${n} is over 8 MB. Crop it to the spec.`, "too_large", 413);
  }
  const mime = (file.type || "").toLowerCase();
  const input = Buffer.from(await file.arrayBuffer());
  const heic = looksHeic(mime, file.name || "", input);
  if (!heic && !mime.startsWith("image/")) {
    throw new OilShotError(`Image ${n} is not an image. Use PNG or JPEG screenshots.`, "bad_image", 415);
  }
  let work: Uint8Array = input;
  if (heic) {
    try {
      const convert = (await import("heic-convert")).default;
      work = new Uint8Array(await convert({ buffer: input, format: "JPEG", quality: 0.9 }));
    } catch {
      throw new OilShotError(`Could not read image ${n} (iPhone format). Take a regular screenshot instead.`, "bad_image", 415);
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
    throw new OilShotError(`Could not read image ${n}. Use PNG or JPEG screenshots.`, "bad_image", 415);
  }
}

/** One field from the screenshots: value + 1-based source image, or blank. */
export type OilShotField<T> = { value: T; image: number } | null;

export type OilShotResult = {
  viscosity: OilShotField<string>;
  qtWithFilter: OilShotField<number>;
  drainTq: OilShotField<number>;
  socketMm: OilShotField<number>;
  /** A capacity was shown but the page said "Including Filter: No" (or did not say). */
  capacityWithoutFilter: boolean;
};

const PROMPT = `You read screenshots of O'Reilly Pro (oreillypro.com) vehicle specification screens for a mechanic.
O'Reilly shows each spec on its OWN screen, identified by the heading at the top of that screen. The screens do NOT show the
vehicle; ignore any year/make/model/engine and do not report them. You get several images, numbered Image 1, Image 2, ... in order.
Describe EACH image separately (one entry per image, image_index = its number). Do not combine images; the server combines them.

ABSOLUTE RULES: Report only what is printed clearly in that image. NEVER guess, infer, estimate, round, convert units, or use your own
knowledge of vehicles. If a value is blurry, cropped, cut off, partly hidden, or you are not certain of every digit, use null.

For each image:
- heading: the screen's heading exactly as printed (for example "Engine oil capacity", "Oil drain plug torque",
  "Engine oil viscosity"), or null if none is visible.
- viscosity_all_temps: only from an engine oil viscosity screen. Some vehicles list viscosity by temperature range in a table
  (the table may scroll sideways and hide columns). Use ONLY the viscosity on the row whose temperature is "All TEMPS"
  (any capitalization), e.g. "5W-30". If there is no All TEMPS row, or its viscosity column is hidden, cut off, or unreadable,
  null. NEVER pick a viscosity from a specific temperature-range row. A screen that lists a single viscosity with no temperature
  table and no temperature qualifier may be reported as that viscosity.
- capacity_qt: only from an engine oil capacity screen: the capacity number in US quarts (qt) exactly as printed, e.g. 4.97.
  null if the unit is not quarts or the number is not fully legible.
- including_filter: on the engine oil capacity screen, the value printed next to "Including Filter": "yes" or "no".
  "not_shown" if that line is not visible or not legible, or this is not a capacity screen.
- drain_plug_torque_ft_lb: only from an oil drain plug torque screen: the torque in ft-lb (lb-ft, ft. lbs.) exactly as printed,
  e.g. 25. null if the value is cropped/missing, only N·m or in-lb is shown, or a range is shown.
- drain_plug_socket_mm: only if a screen clearly states the oil drain plug wrench/socket size in millimeters (mm). Otherwise null.
- legible: false if the image is too blurry/cropped to read its values.
If an image is not an O'Reilly spec screen, set heading null and every value null.`;

const IMAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "image_index",
    "heading",
    "viscosity_all_temps",
    "capacity_qt",
    "including_filter",
    "drain_plug_torque_ft_lb",
    "drain_plug_socket_mm",
    "legible",
  ],
  properties: {
    image_index: { type: "integer" },
    heading: { type: ["string", "null"] },
    viscosity_all_temps: { type: ["string", "null"] },
    capacity_qt: { type: ["number", "null"] },
    including_filter: { type: "string", enum: ["yes", "no", "not_shown"] },
    drain_plug_torque_ft_lb: { type: ["number", "null"] },
    drain_plug_socket_mm: { type: ["number", "null"] },
    legible: { type: "boolean" },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["images"],
  properties: { images: { type: "array", items: IMAGE_SCHEMA } },
} as const;

function inRange(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : positiveNum(v);
  if (n == null || !Number.isFinite(n) || n < lo || n > hi) return null;
  return Math.round(n * 100) / 100;
}

/** "SAE 5w30" → "5W-30". Anything that is not exactly one clear grade → null. */
export function normalizeViscosity(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t || t.length > 40) return null;
  const all = t.toUpperCase().match(/\b\d{1,2}\s*W\s*-?\s*\d{1,2}\b/g);
  if (!all || all.length !== 1) return null;
  const m = all[0].replace(/\s+/g, "").match(/^(\d{1,2})W-?(\d{1,2})$/);
  return m ? `${Number(m[1])}W-${Number(m[2])}` : null;
}

/** One value per field across images; two images disagreeing → blank. */
function pick<T>(seen: { value: T; image: number }[]): OilShotField<T> {
  if (!seen.length) return null;
  const distinct = new Set(seen.map((s) => String(s.value)));
  return distinct.size === 1 ? seen[0] : null;
}

/**
 * Deterministic merge of the model's per-image observations. Implausible values → blank,
 * capacity only with "Including Filter: yes", conflicts between images → blank.
 */
export function mergeOilShots(raw: unknown, imageCount: number): OilShotResult {
  const list = (raw && typeof raw === "object" ? (raw as { images?: unknown }).images : null) ?? [];
  const vis: { value: string; image: number }[] = [];
  const qt: { value: number; image: number }[] = [];
  const tq: { value: number; image: number }[] = [];
  const sock: { value: number; image: number }[] = [];
  let capacityWithoutFilter = false;
  const used = new Set<number>();
  for (const item of Array.isArray(list) ? list : []) {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const image = Number(r.image_index);
    if (!Number.isInteger(image) || image < 1 || image > imageCount || used.has(image)) continue;
    used.add(image);
    if (r.legible === false) continue;
    const v = normalizeViscosity(r.viscosity_all_temps);
    if (v) vis.push({ value: v, image });
    const q = inRange(r.capacity_qt, 1, 20);
    if (q != null) {
      if (r.including_filter === "yes") qt.push({ value: q, image });
      else capacityWithoutFilter = true;
    }
    const t = inRange(r.drain_plug_torque_ft_lb, 3, 100);
    if (t != null) tq.push({ value: t, image });
    const k = inRange(r.drain_plug_socket_mm, 6, 36);
    if (k != null) sock.push({ value: k, image });
  }
  const qtWithFilter = pick(qt);
  return {
    viscosity: pick(vis),
    qtWithFilter,
    drainTq: pick(tq),
    socketMm: pick(sock),
    capacityWithoutFilter: capacityWithoutFilter && !qtWithFilter,
  };
}

/** Calls the vision model once with all images. Throws OilShotError with a user-facing message on failure. */
export async function extractOilShots(dataUrls: string[]): Promise<OilShotResult & { provider: string; model: string }> {
  const p = visionProvider();
  if (!p) throw new OilShotError(visionNotConfiguredMessage(), "not_configured", 503);
  const content: unknown[] = [
    {
      type: "text",
      text: `There are ${dataUrls.length} image(s). Return one entry per image. null for anything not clearly legible.`,
    },
  ];
  dataUrls.forEach((url, i) => {
    content.push({ type: "text", text: `Image ${i + 1}:` });
    content.push({ type: "image_url", image_url: { url, detail: "high" } });
  });
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${p.key}` },
      signal: AbortSignal.timeout(55_000),
      body: JSON.stringify({
        model: p.model,
        temperature: 0,
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "oreilly_spec_screens", strict: true, schema: SCHEMA },
        },
      }),
    });
  } catch (e) {
    console.error("oil_shot model fetch", p.name, e instanceof Error ? e.message : e);
    throw new OilShotError("The screenshot reader did not answer. Try again, or type the spec in.", "model_failed", 502);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("oil_shot model http", p.name, p.model, res.status, body.slice(0, 300));
    const msg =
      res.status === 401 || res.status === 403
        ? `Screenshot reader rejected the API key (${p.keyVar}). Type the spec in.`
        : "The screenshot reader failed. Try again, or type the spec in.";
    throw new OilShotError(msg, "model_failed", 502);
  }
  const json = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null } }[];
  } | null;
  const text = json?.choices?.[0]?.message?.content;
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    console.error("oil_shot model bad json", p.name, String(text ?? "").slice(0, 200));
    throw new OilShotError("Could not read those screenshots. Try again, or type the spec in.", "model_failed", 502);
  }
  return { ...mergeOilShots(parsed, dataUrls.length), provider: p.name, model: p.model };
}
