"use client";

import { useActionState } from "react";
import { CopyField, FormMessage, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  defaultLevel: string;
  hasOpenExam: boolean;
  levels: { value: string; label: string; published: number }[];
  categories: { id: string; name: string }[];
};

export function CreateExamForm({ action, hasOpenExam, defaultLevel, levels, categories }: Props) {
  const [state, formAction] = useActionState(action, {});
  if (state.ok && state.link) {
    return (
      <div className="space-y-3">
        <FormMessage state={state} />
        <CopyField label="Candidate exam link" value={state.link} />
      </div>
    );
  }
  if (hasOpenExam) {
    return <p className="text-sm text-slate-500">This candidate already has an open exam. Revoke it from the exam page to create a new one.</p>;
  }
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="experienceLevel">Exam level</label>
          <select id="experienceLevel" name="experienceLevel" className="input" defaultValue={defaultLevel}>
            {levels.map((l) => (
              <option key={l.value} value={l.value}>{l.label} ({l.published} published)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="questionCount">Number of questions</label>
          <input id="questionCount" name="questionCount" type="number" min={1} max={100} defaultValue={20} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="timeLimitMinutes">Time limit (minutes)</label>
          <input id="timeLimitMinutes" name="timeLimitMinutes" type="number" min={5} max={480} defaultValue={90} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="linkValidDays">Link valid for (days)</label>
          <input id="linkValidDays" name="linkValidDays" type="number" min={1} max={30} defaultValue={7} className="input" />
        </div>
      </div>
      <fieldset>
        <legend className="label">Categories</legend>
        <p className="hint mb-2">Leave all unchecked to draw from every category. Questions are spread evenly across the chosen categories.</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="categoryIds" value={c.id} className="h-4 w-4 rounded border-slate-300" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sendInvitation" defaultChecked className="h-4 w-4 rounded border-slate-300" />
        Email the invitation to the candidate now
      </label>
      <SubmitButton pendingText="Creating exam…">Create exam</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
