import type { IntegrityEventType } from "@/db/schema";

/** Relative weight of each browser signal. Signals are indicators for a reviewer, never proof. */
export const INTEGRITY_WEIGHTS: Record<IntegrityEventType, number> = {
  tab_hidden: 3,
  window_blur: 1,
  copy: 2,
  paste: 4,
  context_menu: 0.5,
  fullscreen_exit: 1,
  devtools_shortcut: 4,
  print_screen: 3,
};

export const INTEGRITY_LABELS: Record<IntegrityEventType, string> = {
  tab_hidden: "Left the exam tab",
  window_blur: "Exam window lost focus",
  copy: "Copy attempt",
  paste: "Paste attempt",
  context_menu: "Right-click",
  fullscreen_exit: "Exited full screen",
  devtools_shortcut: "Developer tools shortcut",
  print_screen: "Screenshot key",
};

export type IntegrityLevel = "low" | "medium" | "high";

export function assessIntegrity(events: readonly { type: IntegrityEventType }[]) {
  const counts = {} as Partial<Record<IntegrityEventType, number>>;
  let score = 0;
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    score += INTEGRITY_WEIGHTS[event.type] ?? 0;
  }
  const level: IntegrityLevel = score >= 15 ? "high" : score >= 6 ? "medium" : "low";
  return { score, level, counts, total: events.length };
}
