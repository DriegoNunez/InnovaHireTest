import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Role } from "@/db/schema";
import { signToken, verifyToken } from "./jwt";

export const STAFF_COOKIE = "innova_session";
const SESSION_HOURS = 10;

export type SessionUser = { id: string; email: string; name: string; role: Role };

export async function startStaffSession(user: SessionUser) {
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const token = await signToken({ sub: user.id, role: user.role, kind: "staff" }, expires);
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endStaffSession() {
  (await cookies()).delete(STAFF_COOKIE);
}

/** Current signed-in staff member, re-validated against the database (deactivation is immediate). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const payload = await verifyToken<{ sub: string; kind: string }>((await cookies()).get(STAFF_COOKIE)?.value);
  if (!payload || payload.kind !== "staff") return null;
  const db = await getDb();
  const [user] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role, active: schema.users.active })
    .from(schema.users)
    .where(eq(schema.users.id, payload.sub));
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

/** Use in pages and server actions. Redirects to login, or 404s on insufficient role. */
export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}
