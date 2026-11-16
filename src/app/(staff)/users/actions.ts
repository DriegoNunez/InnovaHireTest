"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { type ActionState, attempt, formObject } from "@/lib/actions";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { changeOwnPassword, createUser, updateUser } from "@/lib/services/users";

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageUsers"));
  return attempt(async () => {
    await createUser(await getDb(), user, formObject(formData));
    revalidatePath("/users");
    return { ok: true, message: "Account created. Share the temporary password securely and ask them to change it." };
  });
}

export async function updateUserAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(rolesFor("manageUsers"));
  return attempt(async () => {
    await updateUser(await getDb(), user, id, formObject(formData, ["active"]));
    revalidatePath("/users");
    return { ok: true, message: "Saved." };
  });
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  return attempt(async () => {
    const next = String(formData.get("next") ?? "");
    if (next !== String(formData.get("confirm") ?? "")) return { error: "The new passwords do not match." };
    await changeOwnPassword(await getDb(), user, String(formData.get("current") ?? ""), next);
    return { ok: true, message: "Password changed." };
  });
}
