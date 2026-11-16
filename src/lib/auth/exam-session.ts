import "server-only";
import { cookies } from "next/headers";
import { signToken, verifyToken } from "./jwt";

export const EXAM_COOKIE = "innova_exam";

/** Binds this browser to an exam attempt. Valid until one hour past the exam deadline. */
export async function startExamSession(examId: string, deadline: Date) {
  const expires = new Date(deadline.getTime() + 3600_000);
  const token = await signToken({ sub: examId, kind: "exam" }, expires);
  (await cookies()).set(EXAM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export async function getExamSessionId(): Promise<string | null> {
  const payload = await verifyToken<{ sub: string; kind: string }>((await cookies()).get(EXAM_COOKIE)?.value);
  return payload?.kind === "exam" ? payload.sub : null;
}
