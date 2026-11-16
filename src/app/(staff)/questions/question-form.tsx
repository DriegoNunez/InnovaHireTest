"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { ActionState } from "@/lib/actions";
import { EXPERIENCE_LEVELS, QUESTION_STATUSES, QUESTION_TYPES, type QuestionType } from "@/db/schema";
import { EXPERIENCE_LABELS, QUESTION_STATUS_LABELS, QUESTION_TYPE_LABELS } from "@/lib/labels";

type Option = { text: string; isCorrect: boolean };
type Criterion = { criterion: string; guidance: string; maxPoints: number };

export type QuestionFormValue = {
  categoryId: string;
  type: QuestionType;
  experienceLevel: string;
  difficulty: number;
  prompt: string;
  referenceAnswer: string;
  explanation: string;
  points: number;
  allowAttachment: boolean;
  status: string;
  options: Option[];
  rubric: Criterion[];
};

const OBJECTIVE: QuestionType[] = ["single_choice", "multiple_choice", "true_false"];

export function QuestionForm({
  action,
  initial,
  categories,
  readOnly,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial: QuestionFormValue;
  categories: { id: string; name: string }[];
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [q, setQ] = useState<QuestionFormValue>(initial);
  const objective = OBJECTIVE.includes(q.type);
  const rubricTotal = q.rubric.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
  const set = <K extends keyof QuestionFormValue>(key: K, value: QuestionFormValue[K]) => setQ((v) => ({ ...v, [key]: value }));

  const changeType = (type: QuestionType) => {
    setQ((v) => {
      const next = { ...v, type };
      if (type === "true_false") next.options = [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }];
      else if (OBJECTIVE.includes(type) && v.options.length < 2) next.options = [{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }];
      if (!OBJECTIVE.includes(type) && v.rubric.length === 0) next.rubric = [{ criterion: "", guidance: "", maxPoints: v.points || 5 }];
      return next;
    });
  };

  const setOption = (i: number, patch: Partial<Option>) =>
    setQ((v) => ({
      ...v,
      options: v.options.map((o, j) => {
        if (j === i) return { ...o, ...patch };
        // Single-answer types: checking one option unchecks the rest.
        if (patch.isCorrect && v.type !== "multiple_choice") return { ...o, isCorrect: false };
        return o;
      }),
    }));
  const setCriterion = (i: number, patch: Partial<Criterion>) => setQ((v) => ({ ...v, rubric: v.rubric.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify({ ...q, points: objective ? q.points : rubricTotal || q.points })} />
      <fieldset disabled={readOnly} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="type">Type</label>
            <select id="type" className="input" value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)}>
              {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="categoryId">Category</label>
            <select id="categoryId" className="input" value={q.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="experienceLevel">Experience level</label>
            <select id="experienceLevel" className="input" value={q.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)}>
              {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{EXPERIENCE_LABELS[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="difficulty">Difficulty (1–5)</label>
            <input id="difficulty" type="number" min={1} max={5} className="input" value={q.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="points">Points</label>
            {objective ? (
              <input id="points" type="number" min={1} max={100} className="input" value={q.points} onChange={(e) => set("points", Number(e.target.value))} />
            ) : (
              <input id="points" className="input" value={rubricTotal} readOnly aria-describedby="points-hint" />
            )}
            {!objective && <p id="points-hint" className="hint">Sum of the rubric criteria.</p>}
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" className="input" value={q.status} onChange={(e) => set("status", e.target.value)}>
              {QUESTION_STATUSES.map((s) => <option key={s} value={s}>{QUESTION_STATUS_LABELS[s]}</option>)}
            </select>
            <p className="hint">Only published questions are used in new exams.</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="prompt">Question</label>
          <textarea id="prompt" rows={6} className="input" value={q.prompt} onChange={(e) => set("prompt", e.target.value)} required placeholder="State the problem, givens, and what the candidate must provide." />
        </div>

        {objective ? (
          <fieldset>
            <legend className="label">Options <span className="font-normal text-slate-500">— {q.type === "multiple_choice" ? "tick every correct option" : "tick the one correct option"}</span></legend>
            <div className="space-y-2">
              {q.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type={q.type === "multiple_choice" ? "checkbox" : "radio"}
                    name="correct"
                    aria-label={`Option ${i + 1} is correct`}
                    checked={o.isCorrect}
                    onChange={(e) => setOption(i, { isCorrect: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <input className="input" value={o.text} placeholder={`Option ${i + 1}`} onChange={(e) => setOption(i, { text: e.target.value })} readOnly={q.type === "true_false"} />
                  {q.type !== "true_false" && q.options.length > 2 && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setQ((v) => ({ ...v, options: v.options.filter((_, j) => j !== i) }))} aria-label={`Remove option ${i + 1}`}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {q.type !== "true_false" && q.options.length < 8 && (
              <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setQ((v) => ({ ...v, options: [...v.options, { text: "", isCorrect: false }] }))}>Add option</button>
            )}
          </fieldset>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="referenceAnswer">Reference answer</label>
              <textarea id="referenceAnswer" rows={5} className="input" value={q.referenceAnswer} onChange={(e) => set("referenceAnswer", e.target.value)} placeholder="A complete correct solution. Shown to graders (and the AI grader), never to candidates." />
            </div>
            <fieldset>
              <legend className="label">Rubric <span className="font-normal text-slate-500">— total {rubricTotal} pts</span></legend>
              <div className="space-y-2">
                {q.rubric.map((c, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_90px_auto]">
                    <input className="input" placeholder="Criterion" value={c.criterion} onChange={(e) => setCriterion(i, { criterion: e.target.value })} aria-label={`Criterion ${i + 1}`} />
                    <input className="input" placeholder="What earns full marks" value={c.guidance} onChange={(e) => setCriterion(i, { guidance: e.target.value })} aria-label={`Guidance ${i + 1}`} />
                    <input className="input" type="number" min={1} max={100} value={c.maxPoints} onChange={(e) => setCriterion(i, { maxPoints: Number(e.target.value) })} aria-label={`Points for criterion ${i + 1}`} />
                    <button type="button" className="btn-ghost btn-sm" disabled={q.rubric.length === 1} onClick={() => setQ((v) => ({ ...v, rubric: v.rubric.filter((_, j) => j !== i) }))} aria-label={`Remove criterion ${i + 1}`}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setQ((v) => ({ ...v, rubric: [...v.rubric, { criterion: "", guidance: "", maxPoints: 2 }] }))}>Add criterion</button>
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={q.allowAttachment} onChange={(e) => set("allowAttachment", e.target.checked)} />
              Allow the candidate to upload a photo or PDF (hand calculations, sketches)
            </label>
          </>
        )}

        <div>
          <label className="label" htmlFor="explanation">Explanation (optional)</label>
          <textarea id="explanation" rows={2} className="input" value={q.explanation} onChange={(e) => set("explanation", e.target.value)} placeholder="Why the answer is correct. Internal only." />
        </div>
      </fieldset>
      {!readOnly && <SubmitButton>Save question</SubmitButton>}
      <FormMessage state={state} />
    </form>
  );
}
