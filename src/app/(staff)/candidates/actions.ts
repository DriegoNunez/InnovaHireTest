"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { type ActionState, attempt, formObject } from "@/lib/actions";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { createCandidate, setCandidateArchived, updateCandidate } from "@/lib/services/candidates";
import { createExam } from "@/lib/services/exams";

export async function createCandidateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageCandidates"));
  let id = "";
  const result = await attempt(async () => {
    id = (await createCandidate(await getDb(), user, formObject(formData))).id;
  });
  if (result.error) return result;
  redirect(`/candidates/${id}`);
}

export async function updateCandidateAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageCandidates"));
  return attempt(async () => {
    await updateCandidate(await getDb(), user, id, formObject(formData));
    revalidatePath(`/candidates/${id}`);
    return { ok: true, message: "Saved." };
  });
}

export async function archiveCandidateAction(id: string, archived: boolean) {
  const user = await requireUser(rolesFor("manageCandidates"));
  await setCandidateArchived(await getDb(), user, id, archived);
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
}

export async function createExamAction(candidateId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageExams"));
  return attempt(async () => {
    const input = formObject(formData, ["sendInvitation"]);
    input.categoryIds = formData.getAll("categoryIds").map(String);
    const result = await createExam(await getDb(), user, { ...input, candidateId });
    revalidatePath(`/candidates/${candidateId}`);
    const notes = [
      input.sendInvitation ? "Exam created and invitation sent." : "Exam created.",
      result.shortfall > 0
        ? `Only ${Number(input.questionCount) - result.shortfall} matching published questions were available, so the exam is shorter than requested.`
        : "",
      "Copy the link now — for security it is only shown once.",
    ];
    return { ok: true, message: notes.filter(Boolean).join(" "), link: result.link };
  });
}
