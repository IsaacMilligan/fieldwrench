import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ensureReady, getSql } from "./db/index";
import { DEMO_EMAIL, DEMO_SHOP_ID, LIVE_SHOP_ID } from "./shop";

const COOKIE = "fw_session";

export type ShopSession = { email: string; shopId: string; isDemo: boolean };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(s: ShopSession | string) {
  const sess = typeof s === "string" ? await sessionForEmail(s) : s;
  const jwt = await signSession(sess);
  const jar = await cookies();
  jar.set(COOKIE, jwt, cookieOpts());
}

export async function attachSession(
  res: { cookies: { set: (name: string, value: string, opts: object) => void } },
  s: ShopSession | string,
) {
  const sess = typeof s === "string" ? await sessionForEmail(s) : s;
  res.cookies.set(COOKIE, await signSession(sess), cookieOpts());
}

async function signSession(s: ShopSession) {
  return new SignJWT({ email: s.email, shopId: s.shopId, isDemo: s.isDemo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.email)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readSession(): Promise<ShopSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const email = String(payload.email ?? payload.sub ?? "");
    if (!email) return null;
    const shopId = String(payload.shopId ?? "");
    if (shopId) {
      return { email, shopId, isDemo: Boolean(payload.isDemo) };
    }
    return sessionForEmail(email);
  } catch {
    return null;
  }
}

export async function requireSession() {
  const s = await readSession();
  if (!s) redirect("/login");
  return s;
}

async function sessionForEmail(email: string): Promise<ShopSession> {
  await ensureReady();
  const sql = getSql();
  const [user] = await sql<{ shop_id: string; is_demo: number }[]>`
    SELECT shop_id, COALESCE(is_demo, 0)::int AS is_demo FROM users WHERE email = ${email.toLowerCase()}
  `;
  const isDemo = email.toLowerCase() === DEMO_EMAIL || Number(user?.is_demo) === 1;
  return { email: email.toLowerCase(), shopId: user?.shop_id || (isDemo ? DEMO_SHOP_ID : LIVE_SHOP_ID), isDemo };
}

export async function verifyLogin(email: string, password: string): Promise<ShopSession | null> {
  await ensureReady();
  const sql = getSql();
  const [user] = await sql<{ email: string; password_hash: string; shop_id: string; is_demo: number }[]>`
    SELECT email, password_hash, shop_id, COALESCE(is_demo, 0)::int AS is_demo
    FROM users WHERE email = ${email.toLowerCase()}
  `;
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return null;
  return {
    email: user.email,
    shopId: user.shop_id || DEMO_SHOP_ID,
    isDemo: Number(user.is_demo) === 1,
  };
}

export async function ownerExists(): Promise<boolean> {
  await ensureReady();
  const sql = getSql();
  const [row] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users WHERE is_demo = 0`;
  return Number(row?.n ?? 0) > 0;
}

export async function bookingShopId(): Promise<string> {
  return (await ownerExists()) ? LIVE_SHOP_ID : DEMO_SHOP_ID;
}

export async function signupMechanic(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true; session: ShopSession } | { ok: false; error: "closed" | "exists" | "invalid" }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!name || !email || !email.includes("@") || password.length < 8) return { ok: false, error: "invalid" };
  await ensureReady();
  const sql = getSql();
  if (await ownerExists()) return { ok: false, error: "closed" };
  const [taken] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM users WHERE email = ${email}`;
  if (Number(taken?.n ?? 0) > 0) return { ok: false, error: "exists" };
  const hash = bcrypt.hashSync(password, 10);
  await sql`
    INSERT INTO settings (id, shop_name, labor_rate_cents, mileage_rate_cents, lead_hours, theme, seeded, shop_id)
    SELECT 2, 'FieldWrench', 12500, 76, 24, 'light', 0, ${LIVE_SHOP_ID}
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE shop_id = ${LIVE_SHOP_ID})
  `;
  await sql`INSERT INTO users (id, email, password_hash, name, shop_id, is_demo)
    VALUES (${crypto.randomUUID()}, ${email}, ${hash}, ${name}, ${LIVE_SHOP_ID}, 0)`;
  return { ok: true, session: { email, shopId: LIVE_SHOP_ID, isDemo: false } };
}

export const DEMO = {
  email: DEMO_EMAIL,
  password: "driveway",
};
