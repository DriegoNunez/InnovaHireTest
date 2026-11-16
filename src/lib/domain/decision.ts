import type { Decision } from "@/db/schema";
import type { IntegrityLevel } from "./integrity";

export const DECISION_LABELS: Record<Decision, string> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  hire_with_training: "Hire with training",
  further_interview: "Further interview",
  no_hire: "Do not hire",
};

/** Score bands for the suggested decision (percent of available points). */
export const DECISION_BANDS: { min: number; decision: Decision }[] = [
  { min: 85, decision: "strong_hire" },
  { min: 70, decision: "hire" },
  { min: 55, decision: "hire_with_training" },
  { min: 40, decision: "further_interview" },
  { min: 0, decision: "no_hire" },
];

const ORDER: Decision[] = DECISION_BANDS.map((b) => b.decision);

/**
 * Suggests a decision from the score. A high integrity risk caps the suggestion at
 * "further interview" so a person has to talk to the candidate before any offer.
 */
export function suggestDecision(percentage: number, integrity: IntegrityLevel): Decision {
  const band = DECISION_BANDS.find((b) => percentage >= b.min)!.decision;
  if (integrity === "high" && ORDER.indexOf(band) < ORDER.indexOf("further_interview")) {
    return "further_interview";
  }
  return band;
}
