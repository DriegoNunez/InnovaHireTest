import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { type DB, schema } from "@/db";
import { EXPERIENCE_LEVELS } from "@/db/schema";
import { type Actor, audit, describeZodError, ServiceError } from "./common";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const candidateInput = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: optionalText(40),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  yearsExperience: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(60)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  currentCompany: optionalText(120),
  position: optionalText(120),
  notes: optionalText(4000),
});

function parse(raw: unknown) {
  const parsed = candidateInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError(describeZodError(parsed.error));
  return parsed.data;
}

async function assertEmailFree(db: DB, email: string, exceptId?: string) {
  const rows = await db
    .select({ id: schema.candidates.id })
    .from(schema.candidates)
    .where(sql`lower(${schema.candidates.email}) = ${email}`);
  if (rows.some((r) => r.id !== exceptId)) throw new ServiceError("A candidate with this email already exists.", "conflict");
}

export async function createCandidate(db: DB, actor: Actor, raw: unknown) {
  const data = parse(raw);
  await assertEmailFree(db, data.email);
  const [row] = await db
    .insert(schema.candidates)
    .values({ ...data, createdBy: actor?.id ?? null })
    .returning({ id: schema.candidates.id });
  await audit(db, actor, "candidate.create", "candidate", row.id, { email: data.email });
  return row;
}

export async function updateCandidate(db: DB, actor: Actor, id: string, raw: unknown) {
  const data = parse(raw);
  await assertEmailFree(db, data.email, id);
  const [row] = await db
    .update(schema.candidates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.candidates.id, id))
    .returning({ id: schema.candidates.id });
  if (!row) throw new ServiceError("Candidate not found.", "not_found");
  await audit(db, actor, "candidate.update", "candidate", id);
}

export async function setCandidateArchived(db: DB, actor: Actor, id: string, archived: boolean) {
  await db.update(schema.candidates).set({ archived, updatedAt: new Date() }).where(eq(schema.candidates.id, id));
  await audit(db, actor, archived ? "candidate.archive" : "candidate.restore", "candidate", id);
}

export async function listCandidates(db: DB, opts: { search?: string; archived?: boolean } = {}) {
  const where: SQL[] = [eq(schema.candidates.archived, opts.archived ?? false)];
  if (opts.search) {
    const s = `%${opts.search}%`;
    where.push(or(ilike(schema.candidates.firstName, s), ilike(schema.candidates.lastName, s), ilike(schema.candidates.email, s))!);
  }
  return db
    .select({
      id: schema.candidates.id,
      firstName: schema.candidates.firstName,
      lastName: schema.candidates.lastName,
      email: schema.candidates.email,
      experienceLevel: schema.candidates.experienceLevel,
      position: schema.candidates.position,
      createdAt: schema.candidates.createdAt,
      examCount: sql<number>`(select count(*)::int from ${schema.exams} where ${schema.exams.candidateId} = ${schema.candidates.id})`,
      latestStatus: sql<string | null>`(select ${schema.exams.status} from ${schema.exams} where ${schema.exams.candidateId} = ${schema.candidates.id} order by ${schema.exams.createdAt} desc limit 1)`,
    })
    .from(schema.candidates)
    .where(and(...where))
    .orderBy(desc(schema.candidates.createdAt))
    .limit(500);
}

export async function getCandidate(db: DB, id: string) {
  const [row] = await db.select().from(schema.candidates).where(eq(schema.candidates.id, id));
  return row ?? null;
}
