"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import type { ActionState } from "@/lib/actions";
import { endStaffSession, startStaffSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/services/common";
import { authenticate } from "@/lib/services/users";

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:${email}`, 8, 15 * 60_000)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const db = await getDb();
  const user = await authenticate(db, email, password);
  if (!user) return { error: "Incorrect email or password." };
  await startStaffSession(user);
  await audit(db, user, "auth.login", "user", user.id, { ip });
  redirect("/dashboard");
}

export async function logout() {
  await endStaffSession();
  redirect("/login");
}
