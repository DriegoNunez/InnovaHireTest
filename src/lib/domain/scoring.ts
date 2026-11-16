import type { QuestionSnapshot, QuestionType } from "@/db/schema";

export const OBJECTIVE_TYPES: readonly QuestionType[] = ["single_choice", "multiple_choice", "true_false"];
export const WRITTEN_TYPES: readonly QuestionType[] = ["short_answer", "long_answer"];

export const isObjective = (type: QuestionType) => OBJECTIVE_TYPES.includes(type);

export const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Deterministically grades a choice question.
 *
 * - single choice / true-false: full points only for the exact correct option.
 * - multiple choice: partial credit = (correct picks − wrong picks) / number of correct options,
 *   floored at zero. Selecting every option therefore earns nothing.
 */
export function gradeObjective(
  snapshot: Pick<QuestionSnapshot, "type" | "options">,
  selectedOptionIds: readonly string[],
  maxPoints: number,
): { points: number; feedback: string } {
  const correct = new Set(snapshot.options.filter((o) => o.isCorrect).map((o) => o.id));
  const valid = new Set(snapshot.options.map((o) => o.id));
  const selected = [...new Set(selectedOptionIds)].filter((id) => valid.has(id));

  if (selected.length === 0) return { points: 0, feedback: "No option selected." };

  if (snapshot.type !== "multiple_choice") {
    const ok = selected.length === 1 && correct.has(selected[0]);
    return { points: ok ? maxPoints : 0, feedback: ok ? "Correct." : "Incorrect option selected." };
  }

  const hits = selected.filter((id) => correct.has(id)).length;
  const misses = selected.length - hits;
  const ratio = correct.size === 0 ? 0 : Math.max(0, (hits - misses) / correct.size);
  const points = round2(ratio * maxPoints);
  const feedback =
    ratio === 1
      ? "All correct options selected."
      : `${hits} of ${correct.size} correct option(s) selected, ${misses} incorrect selection(s).`;
  return { points, feedback };
}

export type GradedItem = {
  categoryName: string;
  maxPoints: number;
  grade: { points: number; needsReview: boolean } | null;
};

export type ExamScore = {
  earned: number;
  possible: number;
  percentage: number;
  ungraded: number;
  needsReview: number;
  complete: boolean;
  byCategory: { category: string; earned: number; possible: number; percentage: number }[];
};

export function summarizeScore(items: readonly GradedItem[]): ExamScore {
  let earned = 0;
  let possible = 0;
  let ungraded = 0;
  let needsReview = 0;
  const categories = new Map<string, { earned: number; possible: number }>();

  for (const item of items) {
    possible += item.maxPoints;
    const bucket = categories.get(item.categoryName) ?? { earned: 0, possible: 0 };
    bucket.possible += item.maxPoints;
    if (item.grade) {
      earned += item.grade.points;
      bucket.earned += item.grade.points;
      if (item.grade.needsReview) needsReview++;
    } else {
      ungraded++;
    }
    categories.set(item.categoryName, bucket);
  }

  const pct = (e: number, p: number) => (p > 0 ? Math.round((e / p) * 1000) / 10 : 0);
  return {
    earned: round2(earned),
    possible,
    percentage: pct(earned, possible),
    ungraded,
    needsReview,
    complete: ungraded === 0,
    byCategory: [...categories.entries()]
      .map(([category, v]) => ({ category, earned: round2(v.earned), possible: v.possible, percentage: pct(v.earned, v.possible) }))
      .sort((a, b) => a.category.localeCompare(b.category)),
  };
}
