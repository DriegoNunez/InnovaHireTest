'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import {
  DIFFICULTIES,
  EXPERIENCE_LEVELS,
  QUESTION_TYPES,
} from '@/components/admin/QuestionForm';
import { api, resolveApiAssetUrl } from '@/lib/api';
import type { Question } from '@/types';

const labelFor = (options: { value: string; label: string }[], value?: string) =>
  options.find((option) => option.value === value)?.label || value || '';

const optionQuestionTypes = ['multiple_choice_single', 'multiple_choice_multiple', 'true_false'];
const uploadOnlyQuestionTypes = ['calculation_problem'];

export default function QuestionTestPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addToast } = useToast();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [draftAnswer, setDraftAnswer] = useState('');

  useEffect(() => {
    const fetchQuestion = async () => {
      setLoading(true);
      try {
        const response = await api.getQuestion(id);
        setQuestion(response.data);
      } catch {
        addToast({ type: 'error', title: 'Failed to load test preview' });
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [id, addToast]);

  const hasOptions = useMemo(() => question ? optionQuestionTypes.includes(question.type) : false, [question]);
  const isUploadOnly = useMemo(() => question ? uploadOnlyQuestionTypes.includes(question.type) : false, [question]);

  const toggleOption = (optionKey: string) => {
    if (!question) return;

    if (question.type === 'multiple_choice_multiple') {
      setSelectedOptions((current) =>
        current.includes(optionKey)
          ? current.filter((item) => item !== optionKey)
          : [...current, optionKey]
      );
      return;
    }

    setSelectedOptions([optionKey]);
  };

  if (loading || !question) {
    return <LoadingOverlay message="Loading test preview..." />;
  }

  return (
    <>
      <Header
        title="Test View Preview"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Questions', href: '/admin/questions' },
          { label: 'Preview' },
        ]}
        actions={
          <div className="admin-panel-actions">
            <Link href={`/admin/questions/${id}`}>
              <Button variant="secondary">Edit Question</Button>
            </Link>
            <Link href="/admin/questions">
              <Button variant="ghost">Back to Bank</Button>
            </Link>
          </div>
        }
      />

      <div className="exam-layout admin-test-preview">
        <div className="exam-header admin-test-preview-header">
          <div>
            <span className="admin-eyebrow">Candidate Test View</span>
            <h2>{labelFor(QUESTION_TYPES, question.type)}</h2>
          </div>
        </div>
        <div className="exam-progress-bar">
          <div className="exam-progress-fill" style={{ width: '100%' }} />
        </div>

        <main className="exam-content">
          <div className="exam-question-card">
            <div className="exam-question-header">
              <span className="exam-question-number">Question Preview</span>
              <div className="exam-question-meta">
                <Badge variant="blue">{labelFor(QUESTION_TYPES, question.type)}</Badge>
                <Badge variant="neutral">{labelFor(DIFFICULTIES, question.difficulty)}</Badge>
                <Badge variant="neutral">{labelFor(EXPERIENCE_LEVELS, question.experienceLevel)}</Badge>
              </div>
            </div>

            <div className="exam-question-text">{question.text}</div>

            {question.imageUrl && (
              <img
                className="exam-question-image"
                src={resolveApiAssetUrl(question.imageUrl)}
                alt="Question reference"
              />
            )}

            {hasOptions ? (
              <div className="exam-options">
                {(question.options || []).map((option, index) => {
                  const optionKey = option.id || String(index);
                  const selected = selectedOptions.includes(optionKey);
                  return (
                    <button
                      key={optionKey}
                      type="button"
                      className={`exam-option ${selected ? 'exam-option-selected' : ''}`}
                      onClick={() => toggleOption(optionKey)}
                    >
                      <span className={question.type === 'multiple_choice_multiple' ? 'exam-option-checkbox' : 'exam-option-radio'} />
                      <span className="exam-option-text">{option.text || `Option ${index + 1}`}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="exam-solution-area">
                {!isUploadOnly && (
                  <div className="form-group">
                    <label className="form-label">Candidate Answer</label>
                    <textarea
                      className="form-input form-textarea"
                      placeholder="A candidate would type their response here..."
                      value={draftAnswer}
                      onChange={(event) => setDraftAnswer(event.target.value)}
                    />
                  </div>
                )}
                {isUploadOnly && (
                  <div className="solution-upload-panel">
                    <label className="form-label">Upload Your Solution</label>
                    <input className="form-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" />
                    <div className="form-hint">Candidate can attach an image or PDF. Maximum 10 MB.</div>
                  </div>
                )}
              </div>
            )}

            <div className="exam-navigation">
              <Button type="button" variant="secondary" disabled>
                Previous
              </Button>
              <Button type="button" variant="primary" disabled>
                Submit Preview
              </Button>
            </div>
          </div>

          <div className="exam-question-nav">
            <button type="button" className="exam-question-nav-btn exam-question-nav-btn-current">
              1
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
