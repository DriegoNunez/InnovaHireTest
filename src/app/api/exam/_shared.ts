import { NextResponse } from "next/server";
import { getExamSessionId } from "@/lib/auth/exam-session";
import { ServiceError } from "@/lib/services/common";

/** Resolves the candidate's exam from the session cookie, or returns a 401 response. */
export async function withExam(handler: (examId: string) => Promise<Response>) {
  const examId = await getExamSessionId();
  if (!examId) return NextResponse.json({ error: "Your exam session has ended. Reopen the link from your invitation." }, { status: 401 });
  try {
    return await handler(examId);
  } catch (error) {
    if (error instanceof ServiceError) {
      const status = error.code === "not_found" ? 404 : error.code === "forbidden" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: "Something went wrong. Your previous answers are safe." }, { status: 500 });
  }
}
