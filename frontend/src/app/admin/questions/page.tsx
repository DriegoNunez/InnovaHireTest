'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { api, resolveApiAssetUrl } from '@/lib/api';
import {
  DIFFICULTIES,
  EXPERIENCE_LEVELS,
  FALLBACK_CATEGORIES,
  QUESTION_TYPES,
} from '@/components/admin/QuestionForm';
import type { Question, QuestionFilters, QuestionFormData, QuestionType } from '@/types';

const demoQuestions: Question[] = [
  {
    id: 'demo-1',
    category: 'ASCE 7 Loading',
    categoryName: 'ASCE 7 Loading',
    text: 'For a low-rise office building, which ASCE 7 load type is most directly associated with lateral force resisting system design?',
    type: 'multiple_choice_single',
    difficulty: 'level2',
    experienceLevel: 'entry_level',
    status: 'published',
    points: 8,
    tags: ['ASCE 7', 'lateral loads'],
    isActive: true,
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z',
    createdBy: 'Admin',
  },
  {
    id: 'demo-2',
    category: 'Steel Design',
    categoryName: 'Steel Design',
    text: 'Describe the LRFD factored moment check for a simply supported W-shape beam with uniform dead and live load.',
    type: 'calculation_problem',
    difficulty: 'level3',
    experienceLevel: 'pe',
    status: 'published',
    points: 15,
    tags: ['steel', 'LRFD'],
    isActive: true,
    createdAt: '2026-05-19T10:00:00Z',
    updatedAt: '2026-05-19T10:00:00Z',
    createdBy: 'Admin',
  },
  {
    id: 'demo-3',
    category: 'Concrete Design',
    categoryName: 'Concrete Design',
    text: 'Outline the checks you would perform for a reinforced concrete shear wall boundary element in a high seismic demand region.',
    type: 'structural_design',
    difficulty: 'level4',
    experienceLevel: 'pe',
    status: 'draft',
    points: 25,
    tags: ['concrete', 'seismic'],
    isActive: false,
    createdAt: '2026-05-18T10:00:00Z',
    updatedAt: '2026-05-18T10:00:00Z',
    createdBy: 'Admin',
  },
];

const labelFor = (options: { value: string; label: string }[], value?: string) =>
  options.find((option) => option.value === value)?.label || value || '';

const normalizeQuestionType = (type: Question['type']): QuestionType => {
  if (type === 'multiple_choice' || type === 'multiple_choice_single') return 'multiple_choice_single';
  if (type === 'multi_select' || type === 'multiple_choice_multiple') return 'multiple_choice_multiple';
  if (type === 'true_false') return 'true_false';
  if (type === 'calculation_problem') return 'calculation_problem';
  return 'short_answer';
};

const difficultyVariant = (difficulty: Question['difficulty']) => {
  if (difficulty === 'level1' || difficulty === 'level2' || difficulty === 'easy') return 'success' as const;
  if (difficulty === 'level3' || difficulty === 'medium') return 'warning' as const;
  return 'danger' as const;
};

const questionToFormData = (question: Question, status = question.status): QuestionFormData => {
  return {
    categoryId: question.categoryId || FALLBACK_CATEGORIES[0]?.id,
    text: question.text,
    type: normalizeQuestionType(question.type),
    category: question.categoryName || question.category,
    difficulty: question.difficulty,
    experienceLevel: question.experienceLevel || 'entry_level',
    status,
    points: question.points,
    timeLimit: 0,
    imageUrl: question.imageUrl,
    options: (question.options || []).map((option) => ({
      text: option.text,
      isCorrect: option.isCorrect,
      order: option.order,
    })),
    rubric: (question.rubric || []).map((criterion) => ({
      name: criterion.name,
      description: criterion.description,
      maxScore: criterion.maxScore,
      weight: criterion.weight,
      order: criterion.order,
    })),
    explanation: question.explanation,
    tags: question.tags || [],
    isActive: status === 'published',
  };
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [printQuestions, setPrintQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<QuestionFilters>({ page: 1, limit: 10 });
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const response = await api.getQuestions(filters);
        setQuestions(response.data);
        setTotalPages(response.totalPages);
        setTotal(response.total);
      } catch {
        setQuestions(demoQuestions);
        setTotal(demoQuestions.length);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [filters]);

  const handleDeleteQuestion = async (question: Question) => {
    if (!window.confirm('Delete this question from the question bank?')) return;

    setBusyQuestionId(question.id);
    try {
      if (!question.id.startsWith('demo-')) {
        await api.deleteQuestion(question.id);
      }

      setQuestions((current) => current.filter((item) => item.id !== question.id));
      setTotal((current) => Math.max(0, current - 1));
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleToggleQuestionStatus = async (question: Question) => {
    const nextStatus = question.status === 'published' || question.isActive ? 'draft' : 'published';

    setBusyQuestionId(question.id);
    try {
      let nextQuestion: Question = {
        ...question,
        status: nextStatus,
        isActive: nextStatus === 'published',
      };

      if (!question.id.startsWith('demo-')) {
        const response = await api.updateQuestion(question.id, questionToFormData(question, nextStatus));
        nextQuestion = response.data;
      }

      setQuestions((current) => current.map((item) => (item.id === question.id ? nextQuestion : item)));
    } finally {
      setBusyQuestionId(null);
    }
  };

  const answerForQuestion = (question: Question) => {
    const correctOptions = (question.options || [])
      .filter((option) => option.isCorrect)
      .map((option) => option.text)
      .filter(Boolean);

    if (correctOptions.length > 0) return correctOptions.join(', ');
    return question.explanation || 'No official answer entered.';
  };

  const downloadQuestionBankPdf = async () => {
    setIsPreparingPdf(true);
    try {
      const response = await api.getQuestions({ ...filters, page: 1, limit: Math.max(total, 1000) });
      setPrintQuestions(response.data);
      window.setTimeout(() => window.print(), 100);
    } finally {
      window.setTimeout(() => setIsPreparingPdf(false), 250);
    }
  };

  const stats = useMemo(() => {
    const published = questions.filter((question) => question.status === 'published' || question.isActive).length;
    const subjective = questions.filter((question) => (question.rubric || []).length > 0 || !['multiple_choice_single', 'multiple_choice_multiple', 'true_false'].includes(question.type)).length;

    return {
      published,
      draft: questions.length - published,
      subjective,
    };
  }, [questions]);

  const columns = [
    {
      key: 'text',
      header: 'Question',
      sortable: true,
      render: (question: Question) => (
        <div className="admin-table-question">
          <Link href={`/admin/questions/${question.id}`}>
            {question.text.length > 110 ? `${question.text.substring(0, 110)}...` : question.text}
          </Link>
          <div>
            {(question.tags || []).slice(0, 3).map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
    render: (question: Question) => <Badge variant="blue">{labelFor(QUESTION_TYPES, normalizeQuestionType(question.type))}</Badge>,
    },
    {
      key: 'experienceLevel',
      header: 'Level',
      sortable: true,
      render: (question: Question) => <span className="admin-muted-cell">{labelFor(EXPERIENCE_LEVELS, question.experienceLevel)}</span>,
    },
    {
      key: 'difficulty',
      header: 'Difficulty',
      sortable: true,
      render: (question: Question) => (
        <Badge variant={difficultyVariant(question.difficulty)}>
          {labelFor(DIFFICULTIES, question.difficulty)}
        </Badge>
      ),
    },
    {
      key: 'points',
      header: 'Points',
      sortable: true,
      render: (question: Question) => <span style={{ fontWeight: 700 }}>{question.points}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (question: Question) => (
        <StatusBadge status={question.status === 'published' || question.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '260px',
      render: (question: Question) => (
        <div className="table-actions">
          <Link href={`/admin/questions/${question.id}`}>
            <Button variant="ghost" size="sm">Edit</Button>
          </Link>
          <Link href={`/admin/questions/${question.id}/preview`}>
            <Button variant="secondary" size="sm">Preview</Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busyQuestionId === question.id}
            onClick={() => handleToggleQuestionStatus(question)}
          >
            {question.status === 'published' || question.isActive ? 'Make Draft' : 'Publish'}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={busyQuestionId === question.id}
            onClick={() => handleDeleteQuestion(question)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Header
        title="Question Bank"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Questions' }]}
        actions={
          <>
            <Button type="button" variant="secondary" isLoading={isPreparingPdf} onClick={downloadQuestionBankPdf}>
              Download Questions PDF
            </Button>
            <Link href="/admin/questions/new">
              <Button variant="primary">New Question</Button>
            </Link>
          </>
        }
      />
      <div className="page-content">
        <section className="question-bank-print-area">
          <div className="question-bank-print-header">
            <div>
              <span>INNOVA Question Bank</span>
              <h1>Questions and Answers</h1>
            </div>
            <strong>{(printQuestions.length ? printQuestions : questions).length} questions</strong>
          </div>

          <div className="question-bank-print-list">
            {(printQuestions.length ? printQuestions : questions).map((question, index) => (
              <article key={question.id} className="question-bank-print-item">
                <div className="question-bank-print-item-header">
                  <h2>{index + 1}. {question.text}</h2>
                  <span>{question.points} pts</span>
                </div>
                <div className="question-bank-print-meta">
                  <span>{labelFor(QUESTION_TYPES, normalizeQuestionType(question.type))}</span>
                  <span>{labelFor(DIFFICULTIES, question.difficulty)}</span>
                  <span>{labelFor(EXPERIENCE_LEVELS, question.experienceLevel)}</span>
                  <span>{question.categoryName || question.category}</span>
                </div>
                {question.imageUrl && (
                  <img
                    className="question-bank-print-image"
                    src={resolveApiAssetUrl(question.imageUrl)}
                    alt="Question reference"
                  />
                )}
                {question.options && question.options.length > 0 && (
                  <ol className="question-bank-print-options">
                    {question.options.map((option) => (
                      <li key={option.id || option.order} className={option.isCorrect ? 'is-correct' : ''}>
                        {option.text}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="question-bank-print-answer">
                  <label>Answer</label>
                  <p>{answerForQuestion(question)}</p>
                </div>
                {question.rubric && question.rubric.length > 0 && (
                  <div className="question-bank-print-rubric">
                    <label>Rubric</label>
                    {question.rubric.map((criterion) => (
                      <p key={criterion.id || criterion.order}>
                        <strong>{criterion.name}</strong> ({criterion.maxScore} pts): {criterion.description}
                      </p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <div className="admin-summary-strip">
          <div>
            <span>{total}</span>
            <label>Total Questions</label>
          </div>
          <div>
            <span>{stats.published}</span>
            <label>Published</label>
          </div>
          <div>
            <span>{stats.draft}</span>
            <label>Draft or Archived</label>
          </div>
          <div>
            <span>{stats.subjective}</span>
            <label>Rubric Based</label>
          </div>
        </div>

        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Input
              className="search-input"
              placeholder="Search structural questions..."
              value={filters.search || ''}
              onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
            />
          </div>
          <Select
            options={QUESTION_TYPES}
            placeholder="All Types"
            value={filters.type || ''}
            onChange={(event) => setFilters({ ...filters, type: event.target.value as QuestionFilters['type'], page: 1 })}
          />
          <Select
            options={DIFFICULTIES}
            placeholder="All Difficulties"
            value={filters.difficulty || ''}
            onChange={(event) => setFilters({ ...filters, difficulty: event.target.value as QuestionFilters['difficulty'], page: 1 })}
          />
        </div>

        <Table
          columns={columns}
          data={questions}
          keyExtractor={(question) => question.id}
          isLoading={loading}
          emptyMessage="No questions found. Create the first structural engineering question."
          emptyIcon="?"
          currentPage={filters.page || 1}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      </div>
    </>
  );
}
