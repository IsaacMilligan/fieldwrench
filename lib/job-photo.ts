import sharp from "sharp";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function isHeic(file: File, buf: Uint8Array): boolean {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  if (t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif")) return true;
  if (buf.length >= 12) {
    const brand = Buffer.from(buf.subarray(4, 12)).toString("ascii");
    if (brand.startsWith("ftyp") && /heic|heif|mif1|msf1/i.test(brand)) return true;
  }
  return false;
}

async function heicToJpeg(buf: Buffer): Promise<Uint8Array> {
  const convert = (await import("heic-convert")).default;
  const out = await convert({ buffer: buf, format: "JPEG", quality: 0.82 });
  return new Uint8Array(out);
}

export async function prepareJobPhoto(file: File): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pick a photo first.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Photo is over 10MB. Take a smaller shot or lower quality.");
  }
  const input = Buffer.from(await file.arrayBuffer());
  const mime = (file.type || "").toLowerCase();
  if (mime && !mime.startsWith("image/") && !isHeic(file, input)) {
    throw new Error("That file is not a photo (use JPEG, PNG, or the iPhone camera).");
  }
  let work: Uint8Array = input;
  if (isHeic(file, input)) {
    try {
      work = await heicToJpeg(input);
    } catch (e) {
      console.error("upload_photo heic convert", e instanceof Error ? e.message : e);
      throw new Error("Could not read that iPhone photo. Try taking it again as a picture.");
    }
  }
  try {
    const jpeg = await sharp(work)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { buffer: Buffer.from(jpeg), contentType: "image/jpeg" };
  } catch (e) {
    console.error("upload_photo sharp", mime || file.name, e instanceof Error ? e.message : e);
    throw new Error("Could not process that photo.");
  }
}
