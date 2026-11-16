import { ServiceError } from "@/lib/services/common";

export type ActionState = { ok?: boolean; error?: string; message?: string; link?: string };

/** Runs a mutation and converts expected failures into a form error. */
export async function attempt(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }
}

/** Collects form fields into a plain object; checkboxes become booleans. */
export function formObject(formData: FormData, booleans: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$")) continue;
    if (typeof value === "string") out[key] = value;
  }
  for (const key of booleans) out[key] = formData.get(key) === "on" || formData.get(key) === "true";
  return out;
}
