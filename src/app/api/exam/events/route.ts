import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { recordIntegrityEvents } from "@/lib/services/exams";
import { withExam } from "../_shared";

export async function POST(request: Request) {
  return withExam(async (examId) => {
    const body = await request.json().catch(() => ({}));
    await recordIntegrityEvents(await getDb(), examId, body?.events ?? []);
    return NextResponse.json({ ok: true });
  });
}
