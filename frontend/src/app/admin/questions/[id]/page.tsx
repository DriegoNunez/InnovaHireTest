'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  FALLBACK_CATEGORIES,
  QuestionForm,
} from '@/components/admin/QuestionForm';
import { api } from '@/lib/api';
import type { Question, QuestionCategoryOption, QuestionFormData } from '@/types';

const toQuestionFormData = (question: Question): QuestionFormData => ({
  categoryId: question.categoryId,
  text: question.text,
  type: question.type,
  category: question.categoryName || question.category,
  difficulty: question.difficulty,
  experienceLevel: question.experienceLevel || 'entry_level',
  status: question.status || (question.isActive ? 'published' : 'draft'),
  points: question.points,
  timeLimit: question.timeLimit,
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
