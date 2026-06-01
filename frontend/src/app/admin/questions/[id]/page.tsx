'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  FALLBACK_CATEGORIES,
  QuestionForm,
} from '@/components/admin/QuestionForm';
import { api } from '@/lib/api';
import type { Question, QuestionCategoryOption, QuestionFormData, QuestionType } from '@/types';

const normalizeQuestionType = (type: Question['type']): QuestionType => {
  if (type === 'multiple_choice' || type === 'multiple_choice_single') return 'multiple_choice_single';
  if (type === 'multi_select' || type === 'multiple_choice_multiple') return 'multiple_choice_multiple';
  if (type === 'true_false') return 'true_false';
  if (type === 'calculation_problem') return 'calculation_problem';
  return 'short_answer';
};

const toQuestionFormData = (question: Question): QuestionFormData => ({
  categoryId: question.categoryId,
  text: question.text,
  type: normalizeQuestionType(question.type),
  category: question.categoryName || question.category,
  difficulty: question.difficulty,
  experienceLevel: question.experienceLevel || 'entry_level',
  status: question.status || (question.isActive ? 'published' : 'draft'),
  points: question.points,
  timeLimit: 0,
  imageUrl: question.imageUrl || '',
  options: (question.options || []).map((option, index) => ({
    text: option.text,
    isCorrect: option.isCorrect,
    order: option.order || index + 1,
  })),
  rubric: (question.rubric || []).map((criterion, index) => ({
    name: criterion.name,
    description: criterion.description,
    maxScore: criterion.maxScore,
    weight: criterion.weight || criterion.maxScore,
    order: criterion.order || index + 1,
  })),
  explanation: question.explanation || '',
  tags: question.tags || [],
  isActive: question.isActive,
});

export default function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { addToast } = useToast();
  const [question, setQuestion] = useState<Question | null>(null);
  const [categories, setCategories] = useState<QuestionCategoryOption[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [questionResponse, categoryResponse] = await Promise.all([
          api.getQuestion(id),
          api.getQuestionCategories().catch(() => ({ data: FALLBACK_CATEGORIES })),
        ]);
        setQuestion(questionResponse.data);
        setCategories(categoryResponse.data.length > 0 ? categoryResponse.data : FALLBACK_CATEGORIES);
      } catch {
        addToast({ type: 'error', title: 'Failed to load question' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, addToast]);

  const formValue = useMemo(() => (question ? toQuestionFormData(question) : null), [question]);

  const handleSubmit = async (data: QuestionFormData) => {
    setSaving(true);
    try {
      await api.updateQuestion(id, data);
      addToast({ type: 'success', title: 'Question updated successfully' });
      router.push('/admin/questions');
    } catch {
      addToast({ type: 'error', title: 'Failed to update question' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !formValue) {
    return <LoadingOverlay message="Loading question..." />;
  }

  return (
    <>
      <Header
        title="Edit Question"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Questions', href: '/admin/questions' },
          { label: 'Edit' },
        ]}
        actions={
          <Link href={`/admin/questions/${id}/preview`}>
            <Button variant="secondary">Test View Preview</Button>
          </Link>
        }
      />
      <div className="page-content">
        <QuestionForm
          initialValue={formValue}
          categories={categories}
          submitLabel="Save Changes"
          isSubmitting={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </>
  );
}
