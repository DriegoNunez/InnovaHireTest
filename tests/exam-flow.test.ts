import { beforeAll, describe, expect, it } from "vitest";
import { eq, isNotNull, sql } from "drizzle-orm";
import { createPgliteDb, type DB, schema } from "@/db";
import { SAMPLE_QUESTIONS } from "@/db/sample-questions";
import { attachSampleFigures, seedDatabase } from "@/db/seed";
import { createCandidate } from "@/lib/services/candidates";
import type { Grader, WrittenGradingInput } from "@/lib/services/ai-grader";
import { ServiceError } from "@/lib/services/common";
import {
  acceptAiGrade,
  addAttachment,
  createExam,
  examShowsFigure,
  finalizeExam,
  getCandidateView,
  getExamDetail,
  gradeWrittenQuestions,
  processSubmission,
  recordIntegrityEvents,
  reissueLink,
  resolveToken,
  revokeExam,
  saveAnswer,
  setManualGrade,
  startExam,
  submitExam,
  sweepOverdueExams,
} from "@/lib/services/exams";
import { authenticate, createUser, updateUser } from "@/lib/services/users";
import { addFigure, createQuestion, listCategories } from "@/lib/services/questions";

let db: DB;
let admin: { id: string; email: string };

/** Deterministic stand-in for Claude: half marks on every criterion. */
class HalfGrader implements Grader {
  readonly model = "fake-grader";
  calls: WrittenGradingInput[] = [];
  async grade(input: WrittenGradingInput) {
    this.calls.push(input);
    return {
      criteria: input.rubric.map((c) => ({ criterion: c.criterion, maxPoints: c.maxPoints, points: c.maxPoints / 2, rationale: "half" })),
      feedback: "Reasonable attempt.",
      confidence: "medium" as const,
      concerns: [],
      model: this.model,
    };
  }
}

async function newCandidate(email: string, level: "entry" | "mid" | "senior" = "entry") {
  return createCandidate(db, admin, { firstName: "Test", lastName: email.split("@")[0], email, experienceLevel: level });
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeAll(async () => {
  db = await createPgliteDb();
  await seedDatabase(db, { admin: { email: "Admin@Example.com", password: "correct-horse-battery", name: "Admin" }, sampleQuestions: true });
  const [row] = await db.select().from(schema.users);
  admin = { id: row.id, email: row.email };
});

describe("staff accounts", () => {
  it("authenticates case-insensitively and rejects wrong passwords", async () => {
    expect(await authenticate(db, "admin@example.com", "correct-horse-battery")).toMatchObject({ role: "admin" });
    expect(await authenticate(db, "admin@example.com", "wrong-password")).toBeNull();
    expect(await authenticate(db, "nobody@example.com", "whatever-pass")).toBeNull();
  });

  it("keeps at least one active admin and blocks deactivated users", async () => {
    await expect(updateUser(db, admin, admin.id, { name: "Admin", role: "hr", active: true })).rejects.toThrow(ServiceError);
    const hr = await createUser(db, admin, { name: "HR", email: "hr@example.com", role: "hr", password: "hr-password-123" });
    await updateUser(db, admin, hr.id, { name: "HR", role: "hr", active: false });
    expect(await authenticate(db, "hr@example.com", "hr-password-123")).toBeNull();
  });
});

describe("question validation", () => {
  it("requires rubric points to match question points", async () => {
    const [cat] = await listCategories(db);
    await expect(
      createQuestion(db, admin, {
        categoryId: cat.id,
        type: "short_answer",
        experienceLevel: "entry",
        difficulty: 2,
        points: 10,
        prompt: "Explain load paths in a two-storey wood building.",
        referenceAnswer: "Roof → walls → foundation.",
        rubric: [{ criterion: "Path", maxPoints: 4 }],
      }),
    ).rejects.toThrow(/must add up/);
  });
});

describe("question figures", () => {
  it("seeds a figure for every sample question that has one, only once", async () => {
    const withFigure = await db.select({ id: schema.questions.id }).from(schema.questions).where(isNotNull(schema.questions.figureId));
    expect(withFigure).toHaveLength(SAMPLE_QUESTIONS.filter((q) => q.figure).length);
    expect(await attachSampleFigures(db)).toBe(0);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.figures);
    expect(Number(count)).toBe(withFigure.length);
  });

  it("only accepts images, and rejects SVGs with active content", async () => {
    expect(await addFigure(db, admin, { name: "plan.png", type: "image/png", bytes: PNG })).toHaveProperty("id");
    const svg = (body: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
    expect(await addFigure(db, admin, { name: "ok.svg", type: "image/svg+xml", bytes: svg("<rect width='1' height='1'/>") })).toHaveProperty("id");
    await expect(addFigure(db, admin, { name: "x.svg", type: "image/svg+xml", bytes: svg("<script>alert(1)</script>") })).rejects.toThrow(ServiceError);
    await expect(addFigure(db, admin, { name: "x.svg", type: "image/svg+xml", bytes: svg("<rect onload='alert(1)'/>") })).rejects.toThrow(ServiceError);
    await expect(addFigure(db, admin, { name: "x.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.7") })).rejects.toThrow(ServiceError);
    await expect(addFigure(db, admin, { name: "fake.png", type: "image/png", bytes: Buffer.from("not an image") })).rejects.toThrow(ServiceError);
  });

  it("requires a description when a question has a figure", async () => {
    const [cat] = await listCategories(db);
    const figure = await addFigure(db, admin, { name: "f.png", type: "image/png", bytes: PNG });
    const base = {
      categoryId: cat.id,
      type: "single_choice" as const,
      experienceLevel: "entry" as const,
      difficulty: 2,
      points: 5,
      prompt: "Which support is shown in the figure?",
      options: [{ text: "Pin", isCorrect: true }, { text: "Fixed", isCorrect: false }],
    };
    await expect(createQuestion(db, admin, { ...base, figureId: figure.id })).rejects.toThrow(/Describe the figure/);
    const { id } = await createQuestion(db, admin, { ...base, figureId: figure.id, figureAlt: "A pin support." });
    const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
    expect(row).toMatchObject({ figureId: figure.id, figureAlt: "A pin support." });
    await db.update(schema.questions).set({ status: "archived" }).where(eq(schema.questions.id, id));
  });

  it("freezes figures into the exam and shows them to that candidate only", async () => {
    const candidate = await newCandidate("figures@example.com", "senior");
    const { exam } = await createExam(db, admin, { candidateId: candidate.id, experienceLevel: "senior", questionCount: 3, timeLimitMinutes: 60, linkValidDays: 7 });
    const view = (await getCandidateView(db, exam.id))!;
    const figures = view.questions.map((q) => q.figure).filter((f) => f !== null);
    expect(figures.length).toBe(SAMPLE_QUESTIONS.filter((q) => q.experienceLevel === "senior" && q.figure).length);
    expect(figures.every((f) => f.alt.length > 0)).toBe(true);
    expect(await examShowsFigure(db, exam.id, figures[0].id)).toBe(true);
    const other = await db.select({ id: schema.figures.id }).from(schema.figures).where(eq(schema.figures.fileName, "framing-plan.svg"));
    expect(await examShowsFigure(db, exam.id, other[0].id)).toBe(false);
    await revokeExam(db, admin, exam.id);
  });
});

describe("exam lifecycle", () => {
  it("runs from creation to a finalized decision", async () => {
    const candidate = await newCandidate("flow@example.com");
    const { exam, token, shortfall } = await createExam(db, admin, {
      candidateId: candidate.id,
      experienceLevel: "entry",
      questionCount: 50,
      timeLimitMinutes: 60,
      linkValidDays: 7,
      sendInvitation: true,
    });
    expect(shortfall).toBeGreaterThan(0); // only 9 entry questions exist
    const outbox = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.examId, exam.id));
    expect(outbox[0].body).toContain(token);
    await expect(
      createExam(db, admin, { candidateId: candidate.id, experienceLevel: "entry", questionCount: 5, timeLimitMinutes: 60, linkValidDays: 7 }),
    ).rejects.toThrow(/open exam/);

    expect((await resolveToken(db, token)).state).toBe("ready");
    expect((await resolveToken(db, "x".repeat(43))).state).toBe("invalid");

    const started = await startExam(db, token, { ip: "127.0.0.1", userAgent: "test" });
    expect(started.status).toBe("in_progress");
    expect(started.deadlineAt!.getTime() - started.startedAt!.getTime()).toBe(60 * 60_000);
    // Re-opening the link resumes instead of restarting the clock.
    expect((await startExam(db, token, {})).deadlineAt).toEqual(started.deadlineAt);

    const view = (await getCandidateView(db, exam.id))!;
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("referenceAnswer");
    expect(serialized).not.toContain("rubric");

    // Answer every choice question correctly and every written question with text.
    const questions = await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, exam.id));
    for (const q of questions) {
      if (q.snapshot.options.length) {
        await saveAnswer(db, exam.id, { examQuestionId: q.id, selectedOptionIds: q.snapshot.options.filter((o) => o.isCorrect).map((o) => o.id) });
      } else {
        const attachment = q.snapshot.allowAttachment ? await addAttachment(db, exam.id, { name: "calc.png", type: "image/png", bytes: PNG }) : null;
        await saveAnswer(db, exam.id, { examQuestionId: q.id, text: "My worked answer", attachmentId: attachment?.id ?? null });
      }
    }
    await expect(addAttachment(db, exam.id, { name: "evil.pdf", type: "application/pdf", bytes: Buffer.from("MZ...") })).rejects.toThrow(/does not match/);
    await recordIntegrityEvents(db, exam.id, [{ type: "tab_hidden" }, { type: "paste", detail: "12 characters" }]);

    await submitExam(db, exam.id, { auto: false });
    let detail = (await getExamDetail(db, exam.id))!;
    expect(detail.exam.status).toBe("submitted"); // written answers still ungraded
    const objective = detail.items.filter((i) => i.snapshot.options.length);
    expect(objective.every((i) => i.grade?.points === i.points && i.grade?.source === "auto")).toBe(true);
    await expect(saveAnswer(db, exam.id, { examQuestionId: questions[0].id })).rejects.toThrow(/ended/);

    const grader = new HalfGrader();
    await processSubmission(db, exam.id, grader);
    expect(grader.calls.some((c) => c.attachment?.contentType === "image/png")).toBe(true);
    detail = (await getExamDetail(db, exam.id))!;
    expect(detail.exam.status).toBe("graded");
    expect(detail.score.needsReview).toBe(grader.calls.length);
    expect(detail.integrity.counts).toMatchObject({ tab_hidden: 1, paste: 1 });

    await expect(finalizeExam(db, admin, exam.id, { decision: "hire" })).rejects.toThrow(/need review/);

    const written = detail.items.filter((i) => i.grade?.source === "ai");
    await setManualGrade(db, admin, written[0].id, { points: written[0].points, feedback: "Fully correct on review." });
    for (const item of written.slice(1)) await acceptAiGrade(db, admin, item.id);

    // Re-running AI grading never overwrites a human decision.
    await gradeWrittenQuestions(db, exam.id, grader, { regrade: true });
    detail = (await getExamDetail(db, exam.id))!;
    const overridden = detail.items.find((i) => i.id === written[0].id)!;
    expect(overridden.grade).toMatchObject({ source: "human", points: written[0].points });
    // ...but regraded AI drafts need review again.
    for (const item of written.slice(1)) await acceptAiGrade(db, admin, item.id);

    detail = (await getExamDetail(db, exam.id))!;
    expect(detail.score.complete).toBe(true);
    expect(detail.suggested).not.toBeNull();
    await finalizeExam(db, admin, exam.id, { decision: "hire", notes: "Solid fundamentals." });
    detail = (await getExamDetail(db, exam.id))!;
    expect(detail.exam).toMatchObject({ status: "finalized", decision: "hire" });
    await expect(setManualGrade(db, admin, written[0].id, { points: 0 })).rejects.toThrow(/finalized/);
    expect((await resolveToken(db, token)).state).toBe("finished");
  });

  it("auto-submits when the deadline passes and rejects late answers", async () => {
    const candidate = await newCandidate("late@example.com");
    const { exam, token } = await createExam(db, admin, { candidateId: candidate.id, experienceLevel: "entry", questionCount: 3, timeLimitMinutes: 30, linkValidDays: 7 });
    await startExam(db, token, {});
    const [q] = await db.select().from(schema.examQuestions).where(eq(schema.examQuestions.examId, exam.id));
    await saveAnswer(db, exam.id, { examQuestionId: q.id, text: "early", selectedOptionIds: q.snapshot.options.slice(0, 1).map((o) => o.id) });

    await db.update(schema.exams).set({ deadlineAt: new Date(Date.now() - 5 * 60_000) }).where(eq(schema.exams.id, exam.id));
    await expect(saveAnswer(db, exam.id, { examQuestionId: q.id, text: "late" })).rejects.toThrow(/ended/);
    const [row] = await db.select().from(schema.exams).where(eq(schema.exams.id, exam.id));
    expect(row).toMatchObject({ autoSubmitted: true });
    expect(["submitted", "graded"]).toContain(row.status);
  });

  it("sweeps overdue exams in bulk", async () => {
    const candidate = await newCandidate("sweep@example.com");
    const { exam, token } = await createExam(db, admin, { candidateId: candidate.id, experienceLevel: "entry", questionCount: 2, timeLimitMinutes: 10, linkValidDays: 7 });
    await startExam(db, token, {});
    await db.update(schema.exams).set({ deadlineAt: new Date(Date.now() - 60 * 60_000) }).where(eq(schema.exams.id, exam.id));
    expect(await sweepOverdueExams(db)).toContain(exam.id);
  });

  it("invalidates old links on reissue and blocks revoked exams", async () => {
    const candidate = await newCandidate("links@example.com");
    const { exam, token } = await createExam(db, admin, { candidateId: candidate.id, experienceLevel: "entry", questionCount: 2, timeLimitMinutes: 10, linkValidDays: 7 });
    const { token: fresh } = await reissueLink(db, admin, exam.id, { email: false });
    expect((await resolveToken(db, token)).state).toBe("invalid");
    expect((await resolveToken(db, fresh)).state).toBe("ready");
    await revokeExam(db, admin, exam.id);
    expect((await resolveToken(db, fresh)).state).toBe("revoked");
    await expect(startExam(db, fresh, {})).rejects.toThrow(ServiceError);
  });

  it("refuses to start once the link has expired", async () => {
    const candidate = await newCandidate("expired@example.com");
    const { exam, token } = await createExam(db, admin, { candidateId: candidate.id, experienceLevel: "entry", questionCount: 2, timeLimitMinutes: 10, linkValidDays: 1 });
    await db.update(schema.exams).set({ linkExpiresAt: new Date(Date.now() - 1000) }).where(eq(schema.exams.id, exam.id));
    expect((await resolveToken(db, token)).state).toBe("expired");
    await expect(startExam(db, token, {})).rejects.toThrow(/no longer/);
  });

  it("grades blank written answers as zero without calling the AI", async () => {
    const candidate = await newCandidate("blank@example.com", "senior");
    const { exam, token } = await createExam(db, admin, { candidateId: candidate.id, experienceLevel: "senior", questionCount: 10, timeLimitMinutes: 10, linkValidDays: 7 });
    await startExam(db, token, {});
    await submitExam(db, exam.id, { auto: false });
    const grader = new HalfGrader();
    await processSubmission(db, exam.id, grader);
    expect(grader.calls).toHaveLength(0);
    const detail = (await getExamDetail(db, exam.id))!;
    expect(detail.exam.status).toBe("graded");
    expect(detail.score.earned).toBe(0);
    expect(detail.suggested).toBe("no_hire");
  });
});
