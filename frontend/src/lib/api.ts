import type {
  ApiResponse,
  PaginatedResponse,
  AuthResponse,
  LoginCredentials,
  User,
  Question,
  QuestionCategoryOption,
  QuestionFormData,
  QuestionFilters,
  Candidate,
  CandidateFormData,
  CandidateFilters,
  ExamAttempt,
  ExamResult,
  ExamSession,
  ExamConfig,
  ResultFilters,
  AuditLog,
  AuditFilters,
  AdminDashboardStats,
  HRDashboardStats,
  BehaviorEvent,
  QuestionStatus,
  QuestionType,
  DifficultyLevel,
  ExperienceLevel,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5095/api';

type BackendPaged<T> = {
  items?: T[];
  Items?: T[];
  totalCount?: number;
  TotalCount?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
  totalPages?: number;
  TotalPages?: number;
};

type BackendUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt?: string;
};

type BackendQuestion = {
  id: string;
  categoryId: string;
  categoryName: string;
  questionType: number | string;
  difficultyLevel: number | string;
  experienceLevel: number | string;
  questionText: string;
  questionImageUrl?: string;
  explanation?: string;
  points: number;
  timeLimitSeconds: number;
  status: number | string;
  createdAt: string;
  updatedAt?: string;
  options?: BackendQuestionOption[];
  rubrics?: BackendQuestionRubric[];
};

type BackendQuestionOption = {
  id: string;
  optionText: string;
  isCorrect: boolean;
  displayOrder: number;
};

type BackendQuestionRubric = {
  id: string;
  criteria: string;
  maxPoints: number;
  description?: string;
  displayOrder: number;
};

type BackendAuditLog = {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  createdAt: string;
};

const questionTypeToApi: Record<string, number> = {
  multiple_choice_single: 0,
  multiple_choice: 0,
  multiple_choice_multiple: 1,
  multi_select: 1,
  true_false: 2,
  fill_in_blank: 3,
  short_answer: 4,
  long_technical: 5,
  essay: 5,
  calculation_problem: 6,
  structural_design: 7,
  coding: 7,
  drawing_interpretation: 8,
  code_interpretation: 9,
};

const questionTypeFromApi: Record<string, QuestionType> = {
  '0': 'multiple_choice_single',
  MultipleChoiceSingle: 'multiple_choice_single',
  '1': 'multiple_choice_multiple',
  MultipleChoiceMultiple: 'multiple_choice_multiple',
  '2': 'true_false',
  TrueFalse: 'true_false',
  '3': 'fill_in_blank',
  FillInBlank: 'fill_in_blank',
  '4': 'short_answer',
  ShortAnswer: 'short_answer',
  '5': 'long_technical',
  LongTechnical: 'long_technical',
  '6': 'calculation_problem',
  CalculationProblem: 'calculation_problem',
  '7': 'structural_design',
  StructuralDesign: 'structural_design',
  '8': 'drawing_interpretation',
  DrawingInterpretation: 'drawing_interpretation',
  '9': 'code_interpretation',
  CodeInterpretation: 'code_interpretation',
};

const difficultyToApi: Record<string, number> = {
  level1: 1,
  easy: 1,
  level2: 2,
  level3: 3,
  medium: 3,
  level4: 4,
  hard: 4,
  level5: 5,
};

const difficultyFromApi: Record<string, DifficultyLevel> = {
  '1': 'level1',
  Level1: 'level1',
  '2': 'level2',
  Level2: 'level2',
  '3': 'level3',
  Level3: 'level3',
  '4': 'level4',
  Level4: 'level4',
  '5': 'level5',
  Level5: 'level5',
};

const experienceToApi: Record<string, number> = {
  entry_level: 0,
  pe: 1,
  senior_engineer: 2,
};

const experienceFromApi: Record<string, ExperienceLevel> = {
  '0': 'entry_level',
  EntryLevel: 'entry_level',
  '1': 'pe',
  PE: 'pe',
  '2': 'senior_engineer',
  SeniorEngineer: 'senior_engineer',
};

const statusToApi: Record<string, number> = {
  draft: 0,
  published: 1,
  archived: 2,
};

const statusFromApi: Record<string, QuestionStatus> = {
  '0': 'draft',
  Draft: 'draft',
  '1': 'published',
  Published: 'published',
  '2': 'archived',
  Archived: 'archived',
};

const titleCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeRole = (roles: string[] = []): User['role'] =>
  roles.some((role) => role.toLowerCase() === 'admin') ? 'admin' : 'hr';

const mapUser = (user: BackendUser): User => ({
  id: user.id,
  email: user.email,
  name: `${user.firstName} ${user.lastName}`.trim(),
  role: normalizeRole(user.roles),
  isActive: user.isActive,
  roles: user.roles,
  createdAt: user.createdAt,
  updatedAt: user.lastLoginAt || user.createdAt,
});

const mapQuestion = (question: BackendQuestion): Question => {
  const type = questionTypeFromApi[String(question.questionType)] || 'short_answer';
  const difficulty = difficultyFromApi[String(question.difficultyLevel)] || 'level3';
  const experienceLevel = experienceFromApi[String(question.experienceLevel)] || 'entry_level';
  const status = statusFromApi[String(question.status)] || 'draft';

  return {
    id: question.id,
    categoryId: question.categoryId,
    categoryName: question.categoryName,
    text: question.questionText,
    type,
    category: question.categoryName,
    difficulty,
    experienceLevel,
    status,
    points: question.points,
    timeLimit: question.timeLimitSeconds || undefined,
    imageUrl: question.questionImageUrl,
    options: (question.options || [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((option) => ({
        id: option.id,
        text: option.optionText,
        isCorrect: option.isCorrect,
        order: option.displayOrder,
      })),
    rubric: (question.rubrics || [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((rubric) => ({
        id: rubric.id,
        name: rubric.criteria,
        description: rubric.description || '',
        maxScore: rubric.maxPoints,
        weight: rubric.maxPoints,
        order: rubric.displayOrder,
      })),
    explanation: question.explanation,
    tags: [titleCase(type), titleCase(experienceLevel)],
    isActive: status === 'published',
    createdAt: question.createdAt,
    updatedAt: question.updatedAt || question.createdAt,
    createdBy: 'Admin',
  };
};

const mapQuestionRequest = (data: Partial<QuestionFormData>) => ({
  categoryId: data.categoryId,
  questionType: questionTypeToApi[data.type || 'short_answer'],
  difficultyLevel: difficultyToApi[data.difficulty || 'level3'],
  experienceLevel: experienceToApi[data.experienceLevel || 'entry_level'],
  questionText: data.text || '',
  questionImageUrl: data.imageUrl || null,
  explanation: data.explanation || null,
  points: data.points || 0,
  timeLimitSeconds: data.timeLimit || 0,
  status: statusToApi[data.status || (data.isActive ? 'published' : 'draft')],
  options: (data.options || []).map((option, index) => ({
    optionText: option.text,
    isCorrect: option.isCorrect,
    displayOrder: option.order ?? index + 1,
  })),
  rubrics: (data.rubric || []).map((criterion, index) => ({
    criteria: criterion.name,
    maxPoints: criterion.maxScore,
    description: criterion.description,
    displayOrder: criterion.order ?? index + 1,
  })),
});

const mapPaged = <Raw, T>(response: BackendPaged<Raw>, mapper: (item: Raw) => T): PaginatedResponse<T> => {
  const items = response.items || response.Items || [];
  const page = response.page || response.Page || 1;
  const limit = response.pageSize || response.PageSize || 20;
  const total = response.totalCount || response.TotalCount || items.length;

  return {
    data: items.map(mapper),
    total,
    page,
    limit,
    totalPages: response.totalPages || response.TotalPages || Math.max(1, Math.ceil(total / limit)),
  };
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('innova_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('innova_token');
        localStorage.removeItem('innova_user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw {
        message: error.message || error.title || 'Request failed',
        statusCode: response.status,
        errors: error.errors,
      };
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<{
      accessToken: string;
      user: { id: string; email: string; firstName: string; lastName: string; roles: string[] };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    return {
      token: response.accessToken,
      user: {
        id: response.user.id,
        email: response.user.email,
        name: `${response.user.firstName} ${response.user.lastName}`.trim(),
        role: normalizeRole(response.user.roles),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async getProfile(): Promise<ApiResponse<User>> {
    throw new Error('Profile endpoint is not implemented yet');
  }

  async changePassword(): Promise<void> {
    throw new Error('Change password endpoint is not implemented yet');
  }

  async getQuestionCategories(): Promise<ApiResponse<QuestionCategoryOption[]>> {
    const data = await this.request<QuestionCategoryOption[]>('/admin/questions/categories');
    return { data };
  }

  async getQuestions(filters?: QuestionFilters): Promise<PaginatedResponse<Question>> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('SearchText', filters.search);
    if (filters?.type) params.append('QuestionType', String(questionTypeToApi[filters.type]));
    if (filters?.difficulty) params.append('DifficultyLevel', String(difficultyToApi[filters.difficulty]));
    if (filters?.page) params.append('Page', String(filters.page));
    if (filters?.limit) params.append('PageSize', String(filters.limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<BackendPaged<BackendQuestion>>(`/admin/questions${query}`);
    return mapPaged(response, mapQuestion);
  }

  async getQuestion(id: string): Promise<ApiResponse<Question>> {
    const data = await this.request<BackendQuestion>(`/admin/questions/${id}`);
    return { data: mapQuestion(data) };
  }

  async createQuestion(data: QuestionFormData): Promise<ApiResponse<Question>> {
    const response = await this.request<BackendQuestion>('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(mapQuestionRequest(data)),
    });
    return { data: mapQuestion(response) };
  }

  async updateQuestion(id: string, data: Partial<QuestionFormData>): Promise<ApiResponse<Question>> {
    const response = await this.request<BackendQuestion>(`/admin/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mapQuestionRequest(data)),
    });
    return { data: mapQuestion(response) };
  }

  async deleteQuestion(id: string): Promise<void> {
    return this.request(`/admin/questions/${id}`, { method: 'DELETE' });
  }

  async getUsers(): Promise<PaginatedResponse<User>> {
    const response = await this.request<BackendPaged<BackendUser>>('/admin/users?Page=1&PageSize=100');
    return mapPaged(response, mapUser);
  }

  async createUser(data: { email: string; name?: string; password: string; role?: string; firstName?: string; lastName?: string; roles?: string[] }): Promise<ApiResponse<User>> {
    const [fallbackFirstName, ...fallbackLastName] = (data.name || '').trim().split(' ');
    const response = await this.request<BackendUser>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        firstName: data.firstName || fallbackFirstName,
        lastName: data.lastName || fallbackLastName.join(' ') || 'User',
        roles: data.roles || [data.role === 'admin' ? 'Admin' : 'HR'],
      }),
    });
    return { data: mapUser(response) };
  }

  async updateUser(id: string, data: Partial<User> & { firstName?: string; lastName?: string; password?: string; isActive?: boolean; roles?: string[] }): Promise<ApiResponse<User>> {
    const response = await this.request<BackendUser>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        email: data.email,
        firstName: data.firstName || data.name?.split(' ')[0] || '',
        lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || 'User',
        password: data.password || null,
        isActive: data.isActive ?? true,
        roles: data.roles || [data.role === 'admin' ? 'Admin' : 'HR'],
      }),
    });
    return { data: mapUser(response) };
  }

  async deleteUser(id: string): Promise<void> {
    return this.request(`/admin/users/${id}`, { method: 'DELETE' });
  }

  async getCandidates(filters?: CandidateFilters): Promise<PaginatedResponse<Candidate>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('Page', String(filters.page));
    if (filters?.limit) params.append('PageSize', String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<PaginatedResponse<Candidate>>(`/hr/candidates${query}`);
  }

  async getCandidate(id: string): Promise<ApiResponse<Candidate>> {
    return this.request<ApiResponse<Candidate>>(`/hr/candidates/${id}`);
  }

  async createCandidate(data: CandidateFormData): Promise<ApiResponse<Candidate>> {
    return this.request<ApiResponse<Candidate>>('/hr/candidates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCandidate(id: string, data: Partial<CandidateFormData>): Promise<ApiResponse<Candidate>> {
    return this.request<ApiResponse<Candidate>>(`/hr/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async sendInvite(candidateId: string): Promise<ApiResponse<Candidate>> {
    return this.request<ApiResponse<Candidate>>(`/hr/candidates/${candidateId}/invite`, {
      method: 'POST',
    });
  }

  async validateExamToken(token: string): Promise<ApiResponse<{ candidate: Candidate; config: ExamConfig }>> {
    return this.request<ApiResponse<{ candidate: Candidate; config: ExamConfig }>>(`/exam/validate/${token}`);
  }

  async startExam(token: string): Promise<ApiResponse<ExamSession>> {
    return this.request<ApiResponse<ExamSession>>(`/exam/${token}/start`, { method: 'POST' });
  }

  async submitAnswer(token: string, questionId: string, answer: string | string[], timeSpent: number): Promise<void> {
    return this.request(`/exam/${token}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, answer, timeSpent }),
    });
  }

  async submitExam(token: string): Promise<ApiResponse<{ attemptId: string }>> {
    return this.request<ApiResponse<{ attemptId: string }>>(`/exam/${token}/submit`, { method: 'POST' });
  }

  async reportBehavior(token: string, events: BehaviorEvent[]): Promise<void> {
    return this.request(`/exam/${token}/behavior`, {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async getResults(filters?: ResultFilters): Promise<PaginatedResponse<ExamAttempt>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('Page', String(filters.page));
    if (filters?.limit) params.append('PageSize', String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<PaginatedResponse<ExamAttempt>>(`/hr/results${query}`);
  }

  async getResult(attemptId: string): Promise<ApiResponse<ExamResult>> {
    return this.request<ApiResponse<ExamResult>>(`/hr/results/${attemptId}`);
  }

  async getAuditLogs(filters?: AuditFilters): Promise<PaginatedResponse<AuditLog>> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('Action', filters.search);
    if (filters?.action) params.append('Action', filters.action);
    if (filters?.startDate) params.append('FromDate', filters.startDate);
    if (filters?.endDate) params.append('ToDate', filters.endDate);
    if (filters?.page) params.append('Page', String(filters.page));
    if (filters?.limit) params.append('PageSize', String(filters.limit));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<BackendPaged<BackendAuditLog>>(`/admin/audit${query}`);

    return mapPaged(response, (log) => ({
      id: log.id,
      action: log.action as AuditLog['action'],
      userId: log.userId || '',
      userName: log.userEmail || 'System',
      userRole: 'admin',
      targetType: log.entityType,
      targetId: log.entityId || '',
      details: log.newValues || log.oldValues || '',
      ipAddress: log.ipAddress || '',
      userAgent: '',
      timestamp: log.createdAt,
    }));
  }

  async getAdminDashboard(): Promise<ApiResponse<AdminDashboardStats>> {
    return this.request<ApiResponse<AdminDashboardStats>>('/dashboard/admin');
  }

  async getHRDashboard(): Promise<ApiResponse<HRDashboardStats>> {
    return this.request<ApiResponse<HRDashboardStats>>('/dashboard/hr');
  }
}

export const api = new ApiClient(API_BASE);
export default api;
