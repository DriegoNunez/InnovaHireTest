import type { QuestionInput } from "@/lib/services/questions";

/** A sample question. Its category comes from the file it is listed in (see index.ts). */
export type SampleQuestion = Omit<QuestionInput, "categoryId" | "status" | "figureId" | "figureAlt"> & {
  /**
   * Stable id. The seed records each key it loads, so a question staff later edit or
   * delete is never added again. Never change or reuse a key.
   */
  key: string;
  /** SVG in src/db/figures, attached by the seed to questions that have no figure yet. */
  figure?: { file: string; alt: string };
};
