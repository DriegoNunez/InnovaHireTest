import { ActionForm, SubmitButton } from "@/components/forms";
import { QuestionFigure } from "@/components/question-figure";
import { Badge, formatDate } from "@/components/ui";
import { isObjective } from "@/lib/domain/scoring";
import type { getExamDetail } from "@/lib/services/exams";
import { acceptGradeAction, setGradeAction } from "../actions";

type Item = NonNullable<Awaited<ReturnType<typeof getExamDetail>>>["items"][number];

const SOURCE_LABEL = { auto: "Auto-graded", ai: "AI draft", human: "Graded by engineer" } as const;

export function QuestionReview({ examId, item, showAnswers, canGrade, typeLabel }: { examId: string; item: Item; showAnswers: boolean; canGrade: boolean; typeLabel: string }) {
  const { snapshot, answer, grade, attachment } = item;
  const objective = isObjective(snapshot.type);
  const selected = new Set(answer?.selectedOptionIds ?? []);
  const border = grade?.needsReview ? "border-violet-300" : !grade && showAnswers ? "border-amber-300" : "";

  return (
    <article id={`q${item.position}`} className={`card ${border}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink">Q{item.position}</span>
          <Badge>{snapshot.categoryName}</Badge>
          <span className="text-slate-500">{typeLabel}</span>
          {answer?.flagged && <Badge tone="amber">Candidate flagged for review</Badge>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {showAnswers && grade ? (
            <>
              <Badge tone={grade.source === "human" ? "green" : grade.source === "ai" ? "violet" : "blue"}>{SOURCE_LABEL[grade.source]}</Badge>
              {grade.needsReview && <Badge tone="violet">Needs review</Badge>}
              <span className="font-semibold tabular-nums">{grade.points} / {item.points}</span>
            </>
          ) : showAnswers ? (
            <><Badge tone="amber">Not graded</Badge><span className="tabular-nums text-slate-500">— / {item.points}</span></>
          ) : (
            <span className="tabular-nums text-slate-500">{item.points} pts</span>
          )}
        </div>
      </header>

      <div className="space-y-4 px-5 py-4">
        <p className="prose-q text-slate-900">{snapshot.prompt}</p>
        <QuestionFigure figure={snapshot.figure} />

        {objective && (
          <ul className="space-y-1.5">
            {snapshot.options.map((o) => {
              const picked = selected.has(o.id);
              return (
                <li
                  key={o.id}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    o.isCorrect ? "border-emerald-200 bg-emerald-50" : picked && showAnswers ? "border-red-200 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <span className="w-20 shrink-0 text-xs font-medium">
                    {showAnswers && picked ? "Selected" : ""}
                  </span>
                  <span className="flex-1">{o.text}</span>
                  {o.isCorrect && <span className="text-xs font-medium text-emerald-700">Correct</span>}
                </li>
              );
            })}
          </ul>
        )}

        {!objective && showAnswers && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate answer</div>
            {answer?.text?.trim() ? (
              <div className="prose-q rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">{answer.text}</div>
            ) : (
              <p className="text-sm italic text-slate-400">No typed answer.</p>
            )}
            {attachment && (
              <div className="mt-3">
                <a href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">
                  Attached: {attachment.fileName} ({Math.ceil(attachment.size / 1024)} KB)
                </a>
                {attachment.contentType.startsWith("image/") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/attachments/${attachment.id}`} alt={`Candidate attachment for question ${item.position}`} className="mt-2 max-h-[480px] rounded-lg border border-slate-200" />
                )}
              </div>
            )}
            {answer && <p className="mt-2 text-xs text-slate-400">Last saved {formatDate(answer.updatedAt)}</p>}
          </div>
        )}

        {!objective && (
          <details className="rounded-lg border border-slate-200 text-sm">
            <summary className="cursor-pointer px-3 py-2 font-medium">Reference answer &amp; rubric</summary>
            <div className="space-y-3 border-t border-slate-100 px-3 py-3">
              <p className="prose-q">{snapshot.referenceAnswer ?? "—"}</p>
              <ul className="list-disc space-y-1 pl-5">
                {snapshot.rubric.map((r, i) => (
                  <li key={i}><strong>{r.criterion}</strong> ({r.maxPoints} pts){r.guidance ? ` — ${r.guidance}` : ""}</li>
                ))}
              </ul>
            </div>
          </details>
        )}

        {showAnswers && grade && (grade.criteria?.length || grade.feedback || grade.concerns?.length) ? (
          <div className="rounded-lg border border-slate-200 p-3 text-sm">
            {grade.criteria && grade.criteria.length > 0 && (
              <table className="mb-2 w-full text-left">
                <tbody>
                  {grade.criteria.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-3 align-top font-medium">{c.criterion}</td>
                      <td className="w-16 py-1.5 pr-3 align-top tabular-nums">{c.points}/{c.maxPoints}</td>
                      <td className="py-1.5 align-top text-slate-600">{c.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {grade.feedback && <p className="text-slate-700">{grade.feedback}</p>}
            {grade.concerns && grade.concerns.length > 0 && (
              <div className="mt-2 rounded-md bg-amber-50 p-2 text-amber-900">
                <strong>Flagged for the reviewer:</strong>
                <ul className="list-disc pl-5">{grade.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {grade.source === "ai" && `Drafted by ${grade.model} · confidence ${grade.confidence ?? "—"}`}
              {grade.reviewedByName && `${grade.source === "ai" ? " · " : ""}Reviewed by ${grade.reviewedByName} ${formatDate(grade.reviewedAt)}`}
            </p>
          </div>
        ) : null}

        {canGrade && (
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            {grade?.needsReview && (
              <ActionForm action={acceptGradeAction.bind(null, examId, item.id)}>
                <SubmitButton className="btn-primary btn-sm">Accept {grade.points} pts</SubmitButton>
              </ActionForm>
            )}
            {grade?.source === "auto" ? (
              <details className="w-full text-sm">
                <summary className="cursor-pointer text-slate-500">Override automatic score</summary>
                <div className="mt-2">
                <ActionForm action={setGradeAction.bind(null, examId, item.id)} className="flex flex-1 flex-wrap items-end gap-2">
                  <div>
                    <label className="label text-xs" htmlFor={`pts-${item.id}`}>Points</label>
                    <input id={`pts-${item.id}`} name="points" type="number" step="0.5" min={0} max={item.points} defaultValue={grade?.points ?? ""} required className="input w-24" />
                  </div>
                  <div className="min-w-48 flex-1">
                    <label className="label text-xs" htmlFor={`fb-${item.id}`}>Feedback (optional)</label>
                    <input id={`fb-${item.id}`} name="feedback" className="input" placeholder="Why this score?" />
                  </div>
                  <SubmitButton className="btn-secondary btn-sm">{grade ? "Change grade" : "Save grade"}</SubmitButton>
                </ActionForm>
                </div>
              </details>
            ) : (
            <ActionForm action={setGradeAction.bind(null, examId, item.id)} className="flex flex-1 flex-wrap items-end gap-2">
              <div>
                <label className="label text-xs" htmlFor={`pts-${item.id}`}>Points</label>
                <input id={`pts-${item.id}`} name="points" type="number" step="0.5" min={0} max={item.points} defaultValue={grade?.points ?? ""} required className="input w-24" />
              </div>
              <div className="min-w-48 flex-1">
                <label className="label text-xs" htmlFor={`fb-${item.id}`}>Feedback (optional)</label>
                <input id={`fb-${item.id}`} name="feedback" className="input" placeholder="Why this score?" />
              </div>
              <SubmitButton className="btn-secondary btn-sm">{grade ? "Change grade" : "Save grade"}</SubmitButton>
            </ActionForm>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
