import { describe, expect, it } from "vitest";
import { gradeObjective, summarizeScore } from "@/lib/domain/scoring";
import { suggestDecision } from "@/lib/domain/decision";
import { assessIntegrity } from "@/lib/domain/integrity";
import { selectBalanced } from "@/lib/domain/selection";
import { normalizeGraderOutput } from "@/lib/services/ai-grader";

const opts = (correct: string[], all = ["a", "b", "c", "d"]) => all.map((id) => ({ id, text: id, isCorrect: correct.includes(id) }));

describe("gradeObjective", () => {
  it("awards full points only for the exact single answer", () => {
    const q = { type: "single_choice" as const, options: opts(["b"]) };
    expect(gradeObjective(q, ["b"], 5).points).toBe(5);
    expect(gradeObjective(q, ["a"], 5).points).toBe(0);
    expect(gradeObjective(q, ["a", "b"], 5).points).toBe(0);
    expect(gradeObjective(q, [], 5).points).toBe(0);
  });

  it("gives partial credit for multiple choice and penalises wrong picks", () => {
    const q = { type: "multiple_choice" as const, options: opts(["a", "b", "c"]) };
    expect(gradeObjective(q, ["a", "b", "c"], 9).points).toBe(9);
    expect(gradeObjective(q, ["a", "b"], 9).points).toBe(6);
    expect(gradeObjective(q, ["a", "b", "d"], 9).points).toBe(3);
    expect(gradeObjective(q, ["a", "b", "c", "d"], 9).points).toBe(6);
    expect(gradeObjective(q, ["d"], 9).points).toBe(0);
  });

  it("ignores option ids that do not belong to the question", () => {
    const q = { type: "single_choice" as const, options: opts(["b"]) };
    expect(gradeObjective(q, ["zzz", "b"], 5).points).toBe(5);
  });
});

describe("summarizeScore", () => {
  it("totals by category and tracks pending work", () => {
    const s = summarizeScore([
      { categoryName: "Steel", maxPoints: 10, grade: { points: 8, needsReview: false } },
      { categoryName: "Steel", maxPoints: 10, grade: { points: 5, needsReview: true } },
      { categoryName: "Concrete", maxPoints: 5, grade: null },
    ]);
    expect(s).toMatchObject({ earned: 13, possible: 25, percentage: 52, ungraded: 1, needsReview: 1, complete: false });
    expect(s.byCategory.find((c) => c.category === "Steel")).toMatchObject({ earned: 13, possible: 20, percentage: 65 });
  });
});

describe("suggestDecision", () => {
  it("maps score bands", () => {
    expect(suggestDecision(90, "low")).toBe("strong_hire");
    expect(suggestDecision(70, "low")).toBe("hire");
    expect(suggestDecision(60, "medium")).toBe("hire_with_training");
    expect(suggestDecision(45, "low")).toBe("further_interview");
    expect(suggestDecision(10, "low")).toBe("no_hire");
  });
  it("caps the suggestion when integrity risk is high", () => {
    expect(suggestDecision(95, "high")).toBe("further_interview");
    expect(suggestDecision(20, "high")).toBe("no_hire");
  });
});

describe("assessIntegrity", () => {
  it("weights events into a risk level", () => {
    expect(assessIntegrity([]).level).toBe("low");
    expect(assessIntegrity([{ type: "window_blur" }, { type: "context_menu" }]).level).toBe("low");
    expect(assessIntegrity([{ type: "tab_hidden" }, { type: "tab_hidden" }]).level).toBe("medium");
    const many = assessIntegrity(Array.from({ length: 4 }, () => ({ type: "paste" as const })));
    expect(many.level).toBe("high");
    expect(many.counts.paste).toBe(4);
  });
});

describe("selectBalanced", () => {
  it("spreads picks across categories", () => {
    const pool = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, categoryId: "A" })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `b${i}`, categoryId: "B" })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `c${i}`, categoryId: "C" })),
    ];
    const picked = selectBalanced(pool, 6);
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((p) => p.id)).size).toBe(6);
    expect(picked.filter((p) => p.categoryId === "B")).toHaveLength(2);
    expect(picked.filter((p) => p.categoryId === "C")).toHaveLength(2);
  });
  it("returns the whole pool when it is too small", () => {
    expect(selectBalanced([{ id: "x", categoryId: "A" }], 5)).toHaveLength(1);
  });
});

describe("normalizeGraderOutput", () => {
  const rubric = [
    { criterion: "A", guidance: null, maxPoints: 4 },
    { criterion: "B", guidance: null, maxPoints: 2 },
  ];
  it("clamps points to the rubric and rounds to halves", () => {
    const r = normalizeGraderOutput(rubric, { criteria: [{ index: 0, points: 9, rationale: "" }, { index: 1, points: 1.3, rationale: "" }], feedback: "", confidence: "high", concerns: [] }, "m");
    expect(r.criteria.map((c) => c.points)).toEqual([4, 1.5]);
    expect(r.confidence).toBe("high");
  });
  it("scores missing criteria as zero with low confidence", () => {
    const r = normalizeGraderOutput(rubric, { criteria: [{ index: 0, points: -2, rationale: "" }], feedback: "", confidence: "high", concerns: [] }, "m");
    expect(r.criteria.map((c) => c.points)).toEqual([0, 0]);
    expect(r.confidence).toBe("low");
  });
});
