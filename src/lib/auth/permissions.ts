import type { Role } from "@/db/schema";

/**
 * admin    – everything, including staff accounts and the audit log
 * engineer – maintains the question bank, reviews grades and signs off results
 * hr       – manages candidates, creates and sends exams, reads results
 */
const MATRIX = {
  manageUsers: ["admin"],
  viewAudit: ["admin"],
  manageQuestions: ["admin", "engineer"],
  viewQuestions: ["admin", "engineer", "hr"],
  manageCandidates: ["admin", "hr"],
  manageExams: ["admin", "hr"],
  gradeExams: ["admin", "engineer"],
  finalizeExams: ["admin", "engineer"],
  reopenExams: ["admin"],
  viewResults: ["admin", "engineer", "hr"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;

export const can = (role: Role, permission: Permission) => (MATRIX[permission] as readonly Role[]).includes(role);

export const rolesFor = (permission: Permission): readonly Role[] => MATRIX[permission];
