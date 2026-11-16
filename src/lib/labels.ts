import type { ExamStatus, ExperienceLevel, QuestionStatus, QuestionType, Role } from "@/db/schema";

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  entry: "Entry level (EIT)",
  mid: "Project engineer (PE)",
  senior: "Senior engineer",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  true_false: "True / false",
  short_answer: "Short answer",
  long_answer: "Calculation / design problem",
};

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  ready: "Not started",
  in_progress: "In progress",
  submitted: "Grading",
  graded: "Ready for review",
  finalized: "Finalized",
  revoked: "Revoked",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  engineer: "Engineer (question bank & grading)",
  hr: "HR / Recruiting",
};
