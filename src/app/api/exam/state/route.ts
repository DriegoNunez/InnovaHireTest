import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { scheduleGrading } from "@/lib/grading-jobs";
import { expireIfOverdue } from "@/lib/services/exams";
import { withExam } from "../_shared";

/** Lightweight heartbeat: current status, deadline and server clock. */
export async function GET() {
  return withExam(async (examId) => {
    const db = await getDb();
    const [row] = await db.select().from(schema.exams).where(eq(schema.exams.id, examId));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const exam = await expireIfOverdue(db, row);
    if (row.status === "in_progress" && exam.status !== "in_progress") scheduleGrading([examId]);
    return NextResponse.json({ status: exam.status, deadlineAt: exam.deadlineAt, serverNow: new Date().toISOString() });
  });
}
