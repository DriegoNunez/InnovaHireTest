"use client";

import { useActionState } from "react";
import { CopyField, FormMessage, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

export function LinkPanel({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Links are stored only as a fingerprint, so they cannot be shown again. Issue a new one to share it; the previous link stops working.
      </p>
      <form action={formAction} className="flex flex-wrap gap-2">
        <SubmitButton className="btn-secondary" name="email" value="0">Get new link</SubmitButton>
        <SubmitButton className="btn-primary" name="email" value="1">Email new link</SubmitButton>
      </form>
      <FormMessage state={state} />
      {state.link && <CopyField value={state.link} />}
    </div>
  );
}
