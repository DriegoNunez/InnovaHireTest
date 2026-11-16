import "server-only";
import { after } from "next/server";
import { getDb } from "@/db";
import { getConfiguredGrader } from "@/lib/services/ai-grader";
import { processSubmission, sweepOverdueExams } from "@/lib/services/exams";

const inFlight = new Set<string>();

/** Runs AI grading for the given exams after the response is sent. */
export function scheduleGrading(examIds: string[]) {
  const grader = getConfiguredGrader();
  const todo = examIds.filter((id) => !inFlight.has(id));
  if (!todo.length) return;
  todo.forEach((id) => inFlight.add(id));
  after(async () => {
    const db = await getDb();
    for (const id of todo) {
      try {
        const result = await processSubmission(db, id, grader);
        if (result.errors.length) console.warn(`[grading] exam ${id}:`, result.errors.join(" | "));
      } catch (error) {
        console.error(`[grading] exam ${id} failed`, error);
      } finally {
        inFlight.delete(id);
      }
    }
  });
}

/** Auto-submits exams whose time ran out and queues their grading. Call from staff pages. */
export async function sweepAndSchedule() {
  const db = await getDb();
  const ids = await sweepOverdueExams(db);
  if (ids.length) scheduleGrading(ids);
}
