import { buildingCode } from "./building-code";
import { concreteDesign } from "./concrete-design";
import { drawingsDocuments } from "./drawings-documents";
import { innovaEngineeringTest } from "./innova-engineering-test";
import { loads } from "./loads";
import { professionalPractice } from "./professional-practice";
import { steelDesign } from "./steel-design";
import { structuralFundamentals } from "./structural-fundamentals";
import type { SampleQuestion } from "./types";

export type { SampleQuestion } from "./types";
export type Sample = SampleQuestion & { category: string };

/** The sample bank, one file per category. Add a category here and in its own file. */
const BANK: { name: string; description: string; questions: SampleQuestion[] }[] = [
  { name: "Structural Fundamentals", description: "Load paths, member behaviour and basic mechanics.", questions: structuralFundamentals },
  { name: "Steel Design", description: "AISC 360 member and connection design.", questions: steelDesign },
  { name: "Concrete Design", description: "ACI 318 reinforced concrete design and detailing.", questions: concreteDesign },
  { name: "Loads (ASCE 7)", description: "Gravity, wind and seismic loads and load combinations.", questions: loads },
  { name: "Building Code (IBC)", description: "IBC requirements, risk category, special inspections.", questions: buildingCode },
  { name: "Drawings & Documents", description: "Reading and producing construction documents.", questions: drawingsDocuments },
  { name: "Professional Practice", description: "QA/QC, coordination, delegated design and communication.", questions: professionalPractice },
  {
    name: "INNOVA Engineering Test",
    description: "INNOVA's 2025 hand-calculation test for graduates (11 problems). Select only this category for an entry-level exam to give the full test.",
    questions: innovaEngineeringTest,
  },
];

export const SAMPLE_CATEGORIES = BANK.map(({ name, description }) => ({ name, description }));

export const SAMPLE_QUESTIONS: Sample[] = BANK.flatMap((c) => c.questions.map((q) => ({ ...q, category: c.name })));
