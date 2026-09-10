import { get, put } from "@vercel/blob";

export function blobConfigured(): boolean {
  const storeId = process.env["BLOB_STORE_ID"] || "";
  const oidc = process.env["VERCEL_OIDC_TOKEN"] || "";
  const token = process.env["BLOB_READ_WRITE_TOKEN"] || "";
  return Boolean((storeId && oidc) || token);
}

/** Prefer Vercel OIDC + BLOB_STORE_ID; fall back to the long-lived RW token. */
export function blobAuth(): { token?: string; storeId?: string } | null {
  const storeId = process.env["BLOB_STORE_ID"] || "";
  const oidc = process.env["VERCEL_OIDC_TOKEN"] || "";
  const token = process.env["BLOB_READ_WRITE_TOKEN"] || "";
  if (storeId && oidc) return { storeId };
  if (token) return { token };
  return null;
}

export function blobUserMessage(e: unknown): string {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
  const msg = e instanceof Error ? e.message : String(e);
  const m = `${name} ${msg}`.toLowerCase();
  if (/accesserror|access.*mismatch|must be private|cannot.*public|public.*private|private store/.test(m)) {
    return "Blob store is private — upload must use private access.";
  }
  if (/filetoolarge|too large|413|payload/.test(m)) return "Photo is too large.";
  if (/storenotfound|store not found/.test(m)) return "Blob store not found. Reconnect Blob to this project.";
  if (/unauthorized|forbidden|401|403|token|oidc/.test(m)) return "Blob storage not configured.";
  return (msg || "Could not store that photo.").slice(0, 140);
}

export async function putPrivateBlob(pathname: string, body: Buffer, contentType: string) {
  const auth = blobAuth();
  if (!auth) throw new Error("Blob storage not configured");
  return put(pathname, body, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    ...auth,
  });
}

export async function getPrivateBlob(urlOrPathname: string) {
  const auth = blobAuth();
  if (!auth) return null;
  return get(urlOrPathname, { access: "private", ...auth });
}
