import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { saveAnswer } from "@/lib/services/exams";
import { withExam } from "../_shared";

export async function PUT(request: Request) {
  return withExam(async (examId) => {
    await saveAnswer(await getDb(), examId, await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  });
}
