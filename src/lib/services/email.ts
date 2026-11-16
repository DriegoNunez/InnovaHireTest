import { eq } from "drizzle-orm";
import { type DB, schema } from "@/db";

export type OutgoingEmail = { to: string; subject: string; body: string; examId?: string | null };

/**
 * Records every message in the outbox. With SMTP_URL configured the message is delivered;
 * otherwise it is printed to the server log so the link can be shared manually.
 */
export async function sendEmail(db: DB, email: OutgoingEmail) {
  const [row] = await db
    .insert(schema.emailOutbox)
    .values({ to: email.to, subject: email.subject, body: email.body, examId: email.examId ?? null })
    .returning({ id: schema.emailOutbox.id });

  const smtp = process.env.SMTP_URL;
  if (!smtp) {
    if (process.env.NODE_ENV !== "test") console.info(`[email] SMTP not configured. Message for ${email.to}:\n${email.subject}\n${email.body}`);
    await db.update(schema.emailOutbox).set({ status: "logged" }).where(eq(schema.emailOutbox.id, row.id));
    return { delivered: false };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(smtp);
    await transport.sendMail({ from: process.env.EMAIL_FROM || "no-reply@localhost", to: email.to, subject: email.subject, text: email.body });
    await db.update(schema.emailOutbox).set({ status: "sent", sentAt: new Date() }).where(eq(schema.emailOutbox.id, row.id));
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(schema.emailOutbox).set({ status: "failed", error: message }).where(eq(schema.emailOutbox.id, row.id));
    return { delivered: false, error: message };
  }
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
