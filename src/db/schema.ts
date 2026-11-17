import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = ["admin", "engineer", "hr"] as const;
export const roleEnum = pgEnum("role", ROLES);
export type Role = (typeof ROLES)[number];

export const EXPERIENCE_LEVELS = ["entry", "mid", "senior"] as const;
export const experienceLevelEnum = pgEnum("experience_level", EXPERIENCE_LEVELS);
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * single_choice   – one correct option (auto-graded)
 * multiple_choice – one or more correct options (auto-graded, partial credit)
 * true_false      – two options (auto-graded)
 * short_answer    – a few sentences or a numeric result (AI-assisted + human review)
 * long_answer     – design / calculation problem; candidate may attach a photo or PDF of
 *                   hand calculations or sketches (AI-assisted + human review)
 */
export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "long_answer",
] as const;
export const questionTypeEnum = pgEnum("question_type", QUESTION_TYPES);
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_STATUSES = ["draft", "published", "archived"] as const;
export const questionStatusEnum = pgEnum("question_status", QUESTION_STATUSES);
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/**
 * ready        – created, link not yet used
 * in_progress  – candidate started; deadline is running
 * submitted    – candidate finished (or time ran out); grading pending/running
 * graded       – every question has a score; awaiting human review of AI scores
 * finalized    – reviewer recorded the hiring decision; scores are locked
 * revoked      – HR cancelled the exam; link no longer works
 */
export const EXAM_STATUSES = [
  "ready",
  "in_progress",
  "submitted",
  "graded",
  "finalized",
  "revoked",
] as const;
export const examStatusEnum = pgEnum("exam_status", EXAM_STATUSES);
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const GRADE_SOURCES = ["auto", "ai", "human"] as const;
export const gradeSourceEnum = pgEnum("grade_source", GRADE_SOURCES);
export type GradeSource = (typeof GRADE_SOURCES)[number];

export const DECISIONS = [
  "strong_hire",
  "hire",
  "hire_with_training",
  "further_interview",
  "no_hire",
] as const;
export const decisionEnum = pgEnum("decision", DECISIONS);
export type Decision = (typeof DECISIONS)[number];

export const INTEGRITY_EVENT_TYPES = [
  "tab_hidden",
  "window_blur",
  "copy",
  "paste",
  "context_menu",
  "fullscreen_exit",
  "devtools_shortcut",
  "print_screen",
] as const;
export const integrityEventTypeEnum = pgEnum("integrity_event_type", INTEGRITY_EVENT_TYPES);
export type IntegrityEventType = (typeof INTEGRITY_EVENT_TYPES)[number];

export const EMAIL_STATUSES = ["queued", "sent", "failed", "logged"] as const;
export const emailStatusEnum = pgEnum("email_status", EMAIL_STATUSES);

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_name_idx").on(t.name)],
);

/**
 * Images shown with a question (diagrams, sections, plans). Rows are immutable and never
 * deleted: exam snapshots keep pointing at the figure the candidate saw, even after the
 * question is edited to use a different one.
 */
export const figures = pgTable("figures", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    type: questionTypeEnum("type").notNull(),
    experienceLevel: experienceLevelEnum("experience_level").notNull(),
    difficulty: integer("difficulty").notNull().default(2),
    prompt: text("prompt").notNull(),
    /** Reference solution shown to graders (human and AI). Never shown to candidates. */
    referenceAnswer: text("reference_answer"),
    explanation: text("explanation"),
    points: integer("points").notNull(),
    allowAttachment: boolean("allow_attachment").notNull().default(false),
    /** Optional figure shown with the question, and its text alternative. */
    figureId: uuid("figure_id").references(() => figures.id),
    figureAlt: text("figure_alt"),
    status: questionStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("questions_bank_idx").on(t.status, t.experienceLevel)],
);

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  position: integer("position").notNull(),
});

export const rubricCriteria = pgTable("rubric_criteria", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  criterion: text("criterion").notNull(),
  guidance: text("guidance"),
  maxPoints: integer("max_points").notNull(),
  position: integer("position").notNull(),
});

// ---------------------------------------------------------------------------
// Candidates & exams
// ---------------------------------------------------------------------------

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    experienceLevel: experienceLevelEnum("experience_level").notNull(),
    yearsExperience: integer("years_experience"),
    currentCompany: text("current_company"),
    position: text("position"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("candidates_email_idx").on(sql`lower(${t.email})`)],
);

/** Frozen copy of a question as it was when the exam was generated. */
export type QuestionSnapshot = {
  type: QuestionType;
  categoryName: string;
  prompt: string;
  referenceAnswer: string | null;
  explanation: string | null;
  allowAttachment: boolean;
  /** Absent on exams generated before figures existed. */
  figure?: { id: string; alt: string } | null;
  options: { id: string; text: string; isCorrect: boolean }[];
  rubric: { criterion: string; guidance: string | null; maxPoints: number }[];
};

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    title: text("title").notNull(),
    experienceLevel: experienceLevelEnum("experience_level").notNull(),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    totalPoints: integer("total_points").notNull(),
    status: examStatusEnum("status").notNull().default("ready"),
    /** SHA-256 of the candidate access token. The raw token is only ever shown once. */
    tokenHash: text("token_hash").notNull(),
    linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }).notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    autoSubmitted: boolean("auto_submitted").notNull().default(false),
    startIp: text("start_ip"),
    startUserAgent: text("start_user_agent"),
    // Review outcome
    suggestedDecision: decisionEnum("suggested_decision"),
    decision: decisionEnum("decision"),
    reviewerNotes: text("reviewer_notes"),
    finalizedBy: uuid("finalized_by").references(() => users.id),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("exams_token_idx").on(t.tokenHash), index("exams_candidate_idx").on(t.candidateId)],
);

export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id),
    position: integer("position").notNull(),
    points: integer("points").notNull(),
    snapshot: jsonb("snapshot").$type<QuestionSnapshot>().notNull(),
  },
  (t) => [index("exam_questions_exam_idx").on(t.examId)],
);

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examQuestionId: uuid("exam_question_id")
      .notNull()
      .references(() => examQuestions.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    selectedOptionIds: jsonb("selected_option_ids").$type<string[]>().notNull().default([]),
    text: text("text"),
    attachmentId: uuid("attachment_id").references(() => attachments.id, { onDelete: "set null" }),
    flagged: boolean("flagged").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("answers_exam_question_idx").on(t.examQuestionId)],
);

export type CriterionScore = { criterion: string; points: number; maxPoints: number; rationale: string };

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examQuestionId: uuid("exam_question_id")
      .notNull()
      .references(() => examQuestions.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    points: real("points").notNull(),
    maxPoints: integer("max_points").notNull(),
    source: gradeSourceEnum("source").notNull(),
    feedback: text("feedback"),
    criteria: jsonb("criteria").$type<CriterionScore[]>(),
    confidence: text("confidence"),
    concerns: jsonb("concerns").$type<string[]>(),
    /** AI-produced scores must be confirmed (or changed) by a human before finalizing. */
    needsReview: boolean("needs_review").notNull().default(false),
    model: text("model"),
    /** The AI provider's ID for the request that drafted this grade (e.g. OpenAI "resp_…"), for tracing. */
    aiResponseId: text("ai_response_id"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("grades_exam_question_idx").on(t.examQuestionId)],
);

export const integrityEvents = pgTable(
  "integrity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    type: integrityEventTypeEnum("type").notNull(),
    detail: text("detail"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("integrity_events_exam_idx").on(t.examId)],
);

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id").references(() => exams.id, { onDelete: "set null" }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: emailStatusEnum("status").notNull().default("queued"),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);
