import bcrypt from "bcryptjs";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type DB, schema } from "@/db";
import { ROLES } from "@/db/schema";
import { type Actor, audit, describeZodError, ServiceError } from "./common";

const password = z.string().min(10, "Password must be at least 10 characters");

export const userInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES),
});

export async function authenticate(db: DB, email: string, plain: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email.trim().toLowerCase()}`);
  // Always run bcrypt to keep timing similar for unknown emails.
  const ok = await bcrypt.compare(plain, user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !ok || !user.active) return null;
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function listUsers(db: DB) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
}

export async function createUser(db: DB, actor: Actor, raw: unknown) {
  const parsed = userInput.extend({ password }).safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const { password: plain, ...data } = parsed.data;
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${data.email}`);
  if (existing.length) throw new ServiceError("A user with this email already exists.", "conflict");
  const [user] = await db
    .insert(schema.users)
    .values({ ...data, passwordHash: await bcrypt.hash(plain, 12) })
    .returning({ id: schema.users.id });
  await audit(db, actor, "user.create", "user", user.id, { email: data.email, role: data.role });
  return user;
}

export async function updateUser(db: DB, actor: Actor, id: string, raw: unknown) {
  const parsed = z
    .object({ name: userInput.shape.name, role: userInput.shape.role, active: z.boolean(), password: password.optional().or(z.literal("")) })
    .safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const { password: plain, ...data } = parsed.data;
  if (actor?.id === id && (!data.active || data.role !== "admin")) {
    throw new ServiceError("You cannot deactivate yourself or remove your own admin role.");
  }
  if (!data.active || data.role !== "admin") {
    const admins = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`${schema.users.role} = 'admin' and ${schema.users.active} and ${schema.users.id} <> ${id}`);
    if (admins.length === 0) throw new ServiceError("At least one active administrator is required.");
  }
  const update: Partial<typeof schema.users.$inferInsert> = { ...data, updatedAt: new Date() };
  if (plain) update.passwordHash = await bcrypt.hash(plain, 12);
  const [row] = await db.update(schema.users).set(update).where(eq(schema.users.id, id)).returning({ id: schema.users.id });
  if (!row) throw new ServiceError("User not found.", "not_found");
  await audit(db, actor, "user.update", "user", id, { role: data.role, active: data.active, passwordChanged: Boolean(plain) });
}

export async function changeOwnPassword(db: DB, actor: NonNullable<Actor>, current: string, next: string) {
  const parsed = password.safeParse(next);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, actor.id));
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw new ServiceError("Current password is incorrect.");
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(next, 12), updatedAt: new Date() }).where(eq(schema.users.id, actor.id));
  await audit(db, actor, "user.password_change", "user", actor.id);
}
