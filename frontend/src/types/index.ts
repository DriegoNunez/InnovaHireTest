// ============================================================
// INNOVA Exam Platform — TypeScript Types
// ============================================================

// ─── Auth ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'hr';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  roles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Questions ───────────────────────────────────────────────
export type QuestionType =
  | 'multiple_choice_single'
  | 'multiple_choice_multiple'
  | 'true_false'
  | 'fill_in_blank'
  | 'short_answer'
  | 'long_technical'
  | 'calculation_problem'
  | 'structural_design'
  | 'drawing_interpretation'
  | 'code_interpretation'
  | 'multiple_choice'
  | 'multi_select'
  | 'essay'
  | 'coding';
export type DifficultyLevel = 'level1' | 'level2' | 'level3' | 'level4' | 'level5' | 'easy' | 'medium' | 'hard';
export type ExperienceLevel = 'entry_level' | 'pe' | 'senior_engineer';
export type QuestionStatus = 'draft' | 'published' | 'archived';
export type QuestionCategory = string;

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface RubricCriteria {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
  order?: number;
}

export interface Question {
  id: string;
  categoryId?: string;
  categoryName?: string;
  text: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  experienceLevel?: ExperienceLevel;
  status?: QuestionStatus;
  points: number;
  timeLimit?: number; // in seconds
  imageUrl?: string;
  options?: QuestionOption[];
  rubric?: RubricCriteria[];
  explanation?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface QuestionFormData {
  categoryId?: string;
  text: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  experienceLevel?: ExperienceLevel;
  status?: QuestionStatus;
  points: number;
  timeLimit?: number;
  imageUrl?: string;
  options?: Omit<QuestionOption, 'id'>[];
  rubric?: Omit<RubricCriteria, 'id'>[];
  explanation?: string;
  tags: string[];
  isActive: boolean;
}

export interface QuestionCategoryOption {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  questionCount: number;
}

// ─── Candidates ──────────────────────────────────────────────
export type CandidateStatus = 'pending' | 'invited' | 'in_progress' | 'completed' | 'expired';

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  experienceLevel?: ExperienceLevel;
  yearsOfExperience?: number;
  currentCompany?: string;
  status: CandidateStatus;
  inviteToken?: string;
  inviteSentAt?: string;
  inviteExpiresAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CandidateFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  experienceLevel: ExperienceLevel;
  yearsOfExperience?: number;
  currentCompany?: string;
  position?: string;
  department?: string;
  notes?: string;
}

export interface GeneratedExam {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  title: string;
  experienceLevel: ExperienceLevel;
  totalQuestions: number;
  totalPoints: number;
  timeLimitMinutes: number;
  invitationUrl: string;
  tokenExpiresAt?: string;
  createdAt: string;
  latestAttemptStatus?: string;
}

// ─── Exam ────────────────────────────────────────────────────
export interface ExamConfig {
  id: string;
  title: string;
  description: string;
  totalQuestions: number;
  timeLimit: number; // in minutes
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowCalculator: boolean;
  maxAttempts: number;
  rules: string[];
}

export interface ExamAttempt {
  id: string;
  examId?: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  examTitle?: string;
  candidate?: Candidate;
  examConfigId: string;
  examConfig?: ExamConfig;
  status: 'not_started' | 'pending' | 'in_progress' | 'submitted' | 'grading' | 'graded' | 'completed' | 'expired';
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  gradedAt?: string;
  totalScore?: number;
  maxScore?: number;
  percentageScore?: number;
  isPassing?: boolean;
  answers: ExamAnswer[];
  behaviorLog?: BehaviorEvent[];
  misuseRiskScore?: number;
  aiGradingSummary?: string;
  hiringRecommendation?: HiringRecommendation;
}

export interface ExamAnswer {
  id: string;
  questionId: string;
  question?: Question;
  answer: string | string[];
  score?: number;
  maxScore?: number;
  aiScore?: number;
  aiExplanation?: string;
  isCorrect?: boolean;
  timeSpent: number; // in seconds
}

export interface ExamSession {
  examId: string;
  attemptId: string;
  title: string;
  totalQuestions: number;
  timeLimitMinutes: number;
  startedAt: string;
  expiresAt: string;
}

export interface ExamTokenValidation {
  isValid: boolean;
  examId?: string;
  candidateName?: string;
  examTitle?: string;
  hasExistingAttempt: boolean;
}

export interface ExamQuestion {
  examQuestionId: string;
  displayOrder: number;
  points: number;
  questionType: QuestionType;
  questionText: string;
  questionImageUrl?: string;
  timeLimitSeconds: number;
  options: {
    id: string;
    optionText: string;
    displayOrder: number;
  }[];
}

export interface ExamAnswerUpload {
  fileUrl: string;
  fileName: string;
}

// ─── Results ─────────────────────────────────────────────────
export type HiringRecommendation = 'strongly_recommend' | 'recommend' | 'neutral' | 'not_recommend' | 'strongly_not_recommend';

export interface CategoryScore {
  category: QuestionCategory;
  score: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
}

export interface ExamResult {
  attempt: ExamAttempt;
  questions?: ExamResultQuestion[];
  categoryScores: CategoryScore[];
  totalScore: number;
  maxScore: number;
  percentageScore: number;
  isPassing: boolean;
  timeTaken: number; // in minutes
  misuseRiskScore: number;
  aiGradingSummary: string;
  hiringRecommendation: HiringRecommendation;
}

export interface ExamResultQuestion {
  examQuestionId: string;
  displayOrder: number;
  questionText: string;
  questionImageUrl?: string;
  questionType: string;
  points: number;
  answerText?: string;
  selectedOptionIds?: string;
  timeSpentSeconds?: number;
  answeredAt?: string;
  pointsAwarded?: number;
  maxPoints?: number;
  aiFeedback?: string;
  isAutoGraded?: boolean;
  isOverridden?: boolean;
  overrideReason?: string;
  options: {
    id: string;
    optionText: string;
    isCorrect: boolean;
    displayOrder: number;
  }[];
}

// ─── Behavior Monitoring ─────────────────────────────────────
export type BehaviorEventType =
  | 'tab_switch'
  | 'window_blur'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'right_click'
  | 'screenshot_attempt'
  | 'devtools_open'
  | 'fullscreen_exit'
  | 'idle_timeout'
  | 'suspicious_typing';

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  timestamp: string;
  details?: string;
  severity: 'low' | 'medium' | 'high';
}

// ─── Audit Log ───────────────────────────────────────────────
export type AuditAction =
  | 'login'
  | 'logout'
  | 'create_question'
  | 'update_question'
  | 'delete_question'
  | 'create_candidate'
  | 'update_candidate'
  | 'send_invite'
  | 'start_exam'
  | 'submit_exam'
  | 'grade_exam'
  | 'create_user'
  | 'update_user'
  | 'delete_user';

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userRole: UserRole;
  targetType: string;
  targetId: string;
  details?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

// ─── API ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// ─── Dashboard Stats ─────────────────────────────────────────
export interface AdminDashboardStats {
  totalQuestions: number;
  activeQuestions: number;
  totalCandidates: number;
  totalExams: number;
  completedExams: number;
  averageScore: number;
  passingRate: number;
  recentActivity: AuditLog[];
}

export interface HRDashboardStats {
  totalCandidates: number;
  pendingInvites: number;
  inProgressExams: number;
  completedExams: number;
  averageScore: number;
  passingRate: number;
  recentCandidates: Candidate[];
}

// ─── Filters ─────────────────────────────────────────────────
export interface QuestionFilters {
  search?: string;
  type?: QuestionType;
  category?: QuestionCategory;
  difficulty?: DifficultyLevel;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CandidateFilters {
  search?: string;
  status?: CandidateStatus;
  position?: string;
  experienceLevel?: ExperienceLevel;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ResultFilters {
  search?: string;
  status?: ExamAttempt['status'];
  isPassing?: boolean;
  completedOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface AuditFilters {
  search?: string;
  action?: AuditAction;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
