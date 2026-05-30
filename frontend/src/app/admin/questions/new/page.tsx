'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/ui/Toast';
import {
  FALLBACK_CATEGORIES,
  QuestionForm,
  createBlankQuestionForm,
} from '@/components/admin/QuestionForm';
import { api } from '@/lib/api';
import type { QuestionCategoryOption, QuestionFormData } from '@/types';

export default function NewQuestionPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [categories, setCategories] = useState<QuestionCategoryOption[]>(FALLBACK_CATEGORIES);
  const [form, setForm] = useState<QuestionFormData>(() => createBlankQuestionForm(FALLBACK_CATEGORIES));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.getQuestionCategories();
        if (response.data.length > 0) {
          setCategories(response.data);
          setForm(createBlankQuestionForm(response.data));
        }
      } catch {
        setCategories(FALLBACK_CATEGORIES);
      }
    };

    fetchCategories();
  }, []);

  const handleSubmit = async (data: QuestionFormData) => {
    setSaving(true);
    try {
      await api.createQuestion(data);
      addToast({ type: 'success', title: 'Question created successfully' });
      router.push('/admin/questions');
    } catch {
      addToast({ type: 'error', title: 'Failed to create question' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header
        title="New Question"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Questions', href: '/admin/questions' },
          { label: 'New' },
        ]}
      />
      <div className="page-content">
        <QuestionForm
          initialValue={form}
          categories={categories}
          submitLabel="Create Question"
          isSubmitting={saving}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </>
  );
}
