import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { scheduleGrading } from "@/lib/grading-jobs";
import { submitExam } from "@/lib/services/exams";
import { withExam } from "../_shared";

export async function POST() {
  return withExam(async (examId) => {
    const exam = await submitExam(await getDb(), examId, { auto: false });
    if (exam && exam.status !== "in_progress") scheduleGrading([examId]);
    return NextResponse.json({ ok: true, status: exam?.status });
  });
}
