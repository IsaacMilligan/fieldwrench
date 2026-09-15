export const PHOTO_KINDS = ["before", "after", "existing_damage"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const PHOTO_KIND_LABEL: Record<PhotoKind, string> = {
  before: "Before",
  after: "After",
  existing_damage: "Existing damage",
};

export const PHOTO_KIND_ORDER: Array<PhotoKind | ""> = ["", "before", "after", "existing_damage"];

export function parsePhotoKind(raw: unknown): PhotoKind | null {
  const v = String(raw ?? "").trim();
  return (PHOTO_KINDS as readonly string[]).includes(v) ? (v as PhotoKind) : null;
}

export function photoKindLabel(kind: string | null | undefined): string {
  const k = parsePhotoKind(kind);
  return k ? PHOTO_KIND_LABEL[k] : "Unlabeled";
}

export function photoKindCounts(photos: { kind?: string | null }[]) {
  const n = { before: 0, after: 0, existing_damage: 0, unlabeled: 0 };
  for (const p of photos) {
    const k = parsePhotoKind(p.kind);
    if (k) n[k] += 1;
    else n.unlabeled += 1;
  }
  return n;
}

export function photoCountSummary(photos: { kind?: string | null }[]) {
  const n = photoKindCounts(photos);
  const bits: string[] = [];
  if (n.before) bits.push(`${n.before} before`);
  if (n.after) bits.push(`${n.after} after`);
  if (n.existing_damage) bits.push(`${n.existing_damage} damage`);
  if (n.unlabeled) bits.push(`${n.unlabeled} unlabeled`);
  return bits.join(" · ");
}
