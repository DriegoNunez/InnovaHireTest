"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { type ActionState, attempt, formObject } from "@/lib/actions";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { aiGradingStatus, getConfiguredGrader } from "@/lib/services/ai-grader";
import { ServiceError } from "@/lib/services/common";
import {
  acceptAiGrade,
  finalizeExam,
  gradeWrittenQuestions,
  reissueLink,
  reopenReview,
  revokeExam,
  setManualGrade,
} from "@/lib/services/exams";

const refresh = (examId: string) => {
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
};

export async function reissueLinkAction(examId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageExams"));
  return attempt(async () => {
    const email = formData.get("email") === "1";
    const result = await reissueLink(await getDb(), user, examId, { email });
    refresh(examId);
    const sent = email ? (result.delivered ? "Emailed to the candidate. " : "Email could not be delivered automatically (see outbox/log). ") : "";
    return { ok: true, message: `${sent}New link issued; the previous link no longer works.`, link: result.link };
  });
}

export async function revokeExamAction(examId: string, _: ActionState): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageExams"));
  return attempt(async () => {
    await revokeExam(await getDb(), user, examId);
    refresh(examId);
  });
}

export async function runAiGradingAction(examId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("gradeExams"));
  return attempt(async () => {
    const grader = getConfiguredGrader();
    if (!grader) {
      const status = aiGradingStatus();
      throw new ServiceError(`AI grading is off: ${status.enabled ? "no grader available" : status.reason}.`);
    }
    const regrade = formData.get("regrade") === "1";
    const result = await gradeWrittenQuestions(await getDb(), examId, grader, { regrade });
    refresh(examId);
    if (result.failed) return { error: `${result.graded} graded, ${result.failed} failed. ${result.errors[0] ?? ""}` };
    return { ok: true, message: result.graded ? `AI drafted ${result.graded} grade(s). Review each one below.` : "Nothing left for the AI to grade." };
  });
}

export async function setGradeAction(examId: string, examQuestionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("gradeExams"));
  return attempt(async () => {
    await setManualGrade(await getDb(), user, examQuestionId, formObject(formData));
    refresh(examId);
    return { ok: true, message: "Grade saved." };
  });
}

export async function acceptGradeAction(examId: string, examQuestionId: string, _: ActionState): Promise<ActionState> {
  const user = await requireUser(rolesFor("gradeExams"));
  return attempt(async () => {
    await acceptAiGrade(await getDb(), user, examQuestionId);
    refresh(examId);
  });
}

export async function finalizeAction(examId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("finalizeExams"));
  return attempt(async () => {
    await finalizeExam(await getDb(), user, examId, formObject(formData));
    refresh(examId);
    return { ok: true, message: "Review finalized." };
  });
}

export async function reopenAction(examId: string, _: ActionState): Promise<ActionState> {
  const user = await requireUser(rolesFor("reopenExams"));
  return attempt(async () => {
    await reopenReview(await getDb(), user, examId);
    refresh(examId);
  });
}
