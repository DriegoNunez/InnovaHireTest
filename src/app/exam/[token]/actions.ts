"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { startExamSession } from "@/lib/auth/exam-session";
import { rateLimit } from "@/lib/rate-limit";
import { ServiceError } from "@/lib/services/common";
import { startExam } from "@/lib/services/exams";

/** Starts (or resumes) the attempt and binds this browser to it. */
export async function beginExamAction(token: string): Promise<{ error?: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!rateLimit(`start:${ip ?? "local"}`, 30, 10 * 60_000)) return { error: "Too many attempts. Please wait a few minutes." };
  try {
    const exam = await startExam(await getDb(), token, { ip, userAgent: h.get("user-agent") });
    await startExamSession(exam.id, exam.deadlineAt!);
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
  redirect(`/exam/${token}`);
}
