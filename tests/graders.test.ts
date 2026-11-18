import { afterEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { aiGradingStatus, ClaudeGrader, GradingUnavailableError, getConfiguredGrader, type WrittenGradingInput } from "@/lib/services/ai-grader";
import { OpenAIGrader, traceMetadata } from "@/lib/services/openai-grader";

const INPUT: WrittenGradingInput = {
  prompt: "Compute the maximum moment.",
  referenceAnswer: "M = PL/4 = 50 kip-ft",
  rubric: [
    { criterion: "Moment", guidance: "50 kip-ft", maxPoints: 4 },
    { criterion: "Units", guidance: null, maxPoints: 2 },
  ],
  experienceLevel: "entry",
  answerText: null,
  attachment: { fileName: "calc.png", contentType: "image/png", data: Buffer.from("png-bytes") },
};

/** A stand-in OpenAI client that records the request and returns a canned response. */
function fakeOpenAI(response: Record<string, unknown>) {
  const create = vi.fn(async () => ({ id: "resp_test", status: "completed", incomplete_details: null, model: "gpt-test", output: [], output_text: "", usage: { input_tokens: 1200, output_tokens: 300 }, ...response }));
  return { client: { responses: { create } } as unknown as OpenAI, create };
}

const message = (content: unknown[]) => [{ type: "message", content }];

describe("OpenAI grader", () => {
  it("sends the photo with the question and turns the result into rubric scores", async () => {
    const result = { criteria: [{ index: 0, points: 3.7, rationale: "Correct method" }, { index: 1, points: 2, rationale: "Units shown" }], feedback: "Good.", confidence: "high", concerns: [] };
    const { client, create } = fakeOpenAI({ output: message([{ type: "output_text", text: "" }]), output_text: JSON.stringify(result) });
    const grade = await new OpenAIGrader("gpt-5", client).grade(INPUT);

    expect(grade).toMatchObject({ model: "gpt-test", confidence: "high", responseId: "resp_test", usage: { inputTokens: 1200, outputTokens: 300 } });
    expect(grade.criteria.map((c) => c.points)).toEqual([3.5, 2]);
    const request = (create.mock.calls[0] as unknown[])[0] as { input: { content: { type: string; image_url?: string }[] }[]; text: { format: { type: string; strict: boolean } }; store: boolean };
    const content = request.input[0].content;
    expect(content[0]).toMatchObject({ type: "input_image", image_url: `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}` });
    expect(content[1].type).toBe("input_text");
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.store).toBe(false);
  });

  it("sends PDFs as files", async () => {
    const { client, create } = fakeOpenAI({ output_text: JSON.stringify({ criteria: [], feedback: "", confidence: "low", concerns: [] }) });
    await new OpenAIGrader("gpt-5", client).grade({ ...INPUT, attachment: { fileName: "calc.pdf", contentType: "application/pdf", data: Buffer.from("%PDF") } });
    const request = (create.mock.calls[0] as unknown[])[0] as { input: { content: { type: string; filename?: string }[] }[] };
    expect(request.input[0].content[0]).toMatchObject({ type: "input_file", filename: "calc.pdf" });
  });

  it("leaves the answer for manual grading on a refusal, a cut-off or unreadable output", async () => {
    const cases = [
      fakeOpenAI({ output: message([{ type: "refusal", refusal: "no" }]) }),
      fakeOpenAI({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
      fakeOpenAI({ output_text: "not json" }),
    ];
    for (const { client } of cases) await expect(new OpenAIGrader("gpt-5", client).grade(INPUT)).rejects.toThrow(GradingUnavailableError);
  });
});

describe("OpenAI tracing", () => {
  afterEach(() => vi.unstubAllEnvs());
  const TRACE = { examId: "exam-1", examQuestionId: "eq-1", questionId: "q-1", position: 3, category: "Steel Design" };
  const request = (create: ReturnType<typeof fakeOpenAI>["create"]) => (create.mock.calls[0] as unknown[])[0] as { store: boolean; metadata: Record<string, string> };
  const ok = { output_text: JSON.stringify({ criteria: [], feedback: "", confidence: "low", concerns: [] }) };

  it("keeps calls out of OpenAI's logs unless OPENAI_STORE_RESPONSES=true", async () => {
    vi.stubEnv("OPENAI_STORE_RESPONSES", "");
    const off = fakeOpenAI(ok);
    await new OpenAIGrader("gpt-5", off.client).grade({ ...INPUT, trace: TRACE });
    expect(request(off.create).store).toBe(false);

    vi.stubEnv("OPENAI_STORE_RESPONSES", "true");
    const on = fakeOpenAI(ok);
    await new OpenAIGrader("gpt-5", on.client).grade({ ...INPUT, trace: TRACE });
    expect(request(on.create).store).toBe(true);
  });

  it("tags each call with exam and question IDs only", async () => {
    const { client, create } = fakeOpenAI(ok);
    await new OpenAIGrader("gpt-5", client).grade({ ...INPUT, trace: TRACE });
    expect(request(create).metadata).toEqual({
      app: "innova-hire", purpose: "written-answer-grading", level: "entry",
      exam_id: "exam-1", exam_question_id: "eq-1", question_id: "q-1", position: "3", category: "Steel Design",
    });
    // OpenAI allows at most 16 tags, 64-character keys and 512-character values.
    const tags = Object.entries(traceMetadata("senior", { ...TRACE, category: "x".repeat(900) }));
    expect(tags.length).toBeLessThanOrEqual(16);
    expect(tags.every(([k, v]) => k.length <= 64 && v.length <= 512)).toBe(true);
  });
});

describe("choosing the grader", () => {
  afterEach(() => vi.unstubAllEnvs());
  const env = (vars: Record<string, string>) => {
    for (const name of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "AI_GRADING_PROVIDER", "AI_GRADING_DISABLED"]) vi.stubEnv(name, vars[name] ?? "");
  };

  it("uses whichever key is set, Claude first, unless a provider is named", () => {
    env({});
    expect(getConfiguredGrader()).toBeNull();
    env({ OPENAI_API_KEY: "test" });
    expect(getConfiguredGrader()).toBeInstanceOf(OpenAIGrader);
    env({ OPENAI_API_KEY: "test", ANTHROPIC_API_KEY: "test" });
    expect(getConfiguredGrader()).toBeInstanceOf(ClaudeGrader);
    env({ OPENAI_API_KEY: "test", ANTHROPIC_API_KEY: "test", AI_GRADING_PROVIDER: "openai" });
    expect(getConfiguredGrader()).toBeInstanceOf(OpenAIGrader);
    env({ ANTHROPIC_API_KEY: "test", AI_GRADING_PROVIDER: "openai" });
    expect(getConfiguredGrader()).toBeNull();
    env({ OPENAI_API_KEY: "test", AI_GRADING_DISABLED: "true" });
    expect(getConfiguredGrader()).toBeNull();
  });

  it("reports which provider is active, or why AI grading is off", () => {
    env({ OPENAI_API_KEY: "test" });
    expect(aiGradingStatus()).toMatchObject({ enabled: true, provider: "openai", providerLabel: "OpenAI" });
    env({ ANTHROPIC_API_KEY: "test", OPENAI_API_KEY: "test" });
    expect(aiGradingStatus()).toMatchObject({ enabled: true, provider: "anthropic" });
    env({ ANTHROPIC_API_KEY: "test", OPENAI_API_KEY: "test", AI_GRADING_PROVIDER: "openai" });
    expect(aiGradingStatus()).toMatchObject({ enabled: true, provider: "openai" });

    const reason = () => { const s = aiGradingStatus(); return s.enabled ? null : s.reason; };
    env({});
    expect(reason()).toMatch(/ANTHROPIC_API_KEY or OPENAI_API_KEY/);
    env({ ANTHROPIC_API_KEY: "test", AI_GRADING_PROVIDER: "openai" });
    expect(reason()).toMatch(/OPENAI_API_KEY is not set/);
    env({ OPENAI_API_KEY: "test", AI_GRADING_PROVIDER: "gemini" });
    expect(reason()).toMatch(/must be "anthropic" or "openai"/);
    env({ OPENAI_API_KEY: "test", AI_GRADING_DISABLED: "true" });
    expect(reason()).toMatch(/AI_GRADING_DISABLED/);
  });
});
