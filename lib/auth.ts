import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db/queries";

const COOKIE = "fw_session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(email: string) {
  const jwt = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readSession(): Promise<{ email: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const email = String(payload.email ?? payload.sub ?? "");
    if (!email) return null;
    return { email };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const s = await readSession();
  if (!s) redirect("/login");
  return s;
}

export async function verifyLogin(email: string, password: string) {
  const sql = await db();
  const [user] = await sql<{ email: string; password_hash: string }[]>`
    SELECT email, password_hash FROM users WHERE email = ${email.toLowerCase()}
  `;
  if (!user) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

export const DEMO = {
  email: "wrench@fieldwrench.local",
  password: "driveway",
};
