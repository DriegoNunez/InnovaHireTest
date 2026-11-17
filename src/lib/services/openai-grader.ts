import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  GradingUnavailableError,
  gradingPromptText,
  normalizeGraderOutput,
  OUTPUT_SCHEMA,
  outputParser,
  SYSTEM_PROMPT,
  type Grader,
  type GradingTrace,
  type WrittenGradingInput,
  type WrittenGradingResult,
} from "./ai-grader";

/** Default OpenAI model for drafting grades; override with OPENAI_GRADING_MODEL. */
export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

/** Reasoning models accept a reasoning effort; others reject the parameter. */
const isReasoningModel = (model: string) => /^(gpt-5|o\d)/.test(model);

/**
 * With OPENAI_STORE_RESPONSES=true, OpenAI keeps each grading request and response (for at
 * least 30 days, candidate answers included) so it shows in the dashboard under Logs → Responses.
 * Off by default.
 */
export const storesResponses = () => process.env.OPENAI_STORE_RESPONSES === "true";

/** Tags for finding a call in OpenAI's logs: IDs and question context only, no candidate details. */
export function traceMetadata(level: string, trace: GradingTrace | null | undefined): Record<string, string> {
  const tags: Record<string, string> = { app: "innova-hire", purpose: "written-answer-grading", level };
  if (trace) {
    tags.exam_id = trace.examId;
    tags.exam_question_id = trace.examQuestionId;
    if (trace.questionId) tags.question_id = trace.questionId;
    tags.position = String(trace.position);
    tags.category = trace.category.slice(0, 512);
  }
  return tags;
}

/**
 * Drafts rubric scores with OpenAI's Responses API. Same instructions, output format and
 * checks as the Claude grader, so drafts look the same to reviewers.
 */
export class OpenAIGrader implements Grader {
  private client: OpenAI;

  constructor(
    readonly model: string = process.env.OPENAI_GRADING_MODEL || DEFAULT_OPENAI_MODEL,
    client?: OpenAI,
  ) {
    this.client = client ?? new OpenAI();
  }

  async grade(input: WrittenGradingInput): Promise<WrittenGradingResult> {
    const content: ResponseInputContent[] = [];
    if (input.attachment) {
      const dataUrl = `data:${input.attachment.contentType};base64,${input.attachment.data.toString("base64")}`;
      if (input.attachment.contentType === "application/pdf") {
        content.push({ type: "input_file", filename: input.attachment.fileName, file_data: dataUrl });
      } else {
        content.push({ type: "input_image", image_url: dataUrl, detail: "high" });
      }
    }
    content.push({ type: "input_text", text: gradingPromptText(input) });

    const response = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content }],
      max_output_tokens: 16000,
      ...(isReasoningModel(this.model) ? { reasoning: { effort: "medium" as const } } : {}),
      text: { format: { type: "json_schema", name: "rubric_grade", schema: OUTPUT_SCHEMA, strict: true } },
      // Off unless OPENAI_STORE_RESPONSES=true: then the call (and these tags) appear in OpenAI's dashboard logs.
      store: storesResponses(),
      metadata: traceMetadata(input.experienceLevel, input.trace),
    });

    if (response.status === "incomplete") {
      throw new GradingUnavailableError(
        response.incomplete_details?.reason === "max_output_tokens"
          ? "The AI grader ran out of output tokens; grade it manually."
          : "The AI grader stopped before finishing; grade it manually.",
      );
    }
    const refused = response.output.some((item) => item.type === "message" && item.content.some((c) => c.type === "refusal"));
    if (refused) throw new GradingUnavailableError("The AI grader declined this answer; grade it manually.");

    let parsed;
    try {
      parsed = outputParser.parse(JSON.parse(response.output_text));
    } catch {
      throw new GradingUnavailableError("The AI grader returned an unreadable result; grade it manually.");
    }
    return {
      ...normalizeGraderOutput(input.rubric, parsed, response.model),
      responseId: response.id,
      usage: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null,
    };
  }
}
