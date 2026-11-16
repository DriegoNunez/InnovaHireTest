import type { DB } from "@/db";
import { schema } from "@/db";

/** An error whose message is safe to show to the user. */
export class ServiceError extends Error {
  constructor(message: string, readonly code: "invalid" | "not_found" | "conflict" | "forbidden" = "invalid") {
    super(message);
    this.name = "ServiceError";
  }
}

export type Actor = { id: string; email: string } | null;

export async function audit(
  db: DB,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(schema.auditLogs).values({
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? "system",
    action,
    entityType,
    entityId,
    details: details ?? null,
  });
}

/** Formats a zod error into one readable sentence. */
export function describeZodError(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}
