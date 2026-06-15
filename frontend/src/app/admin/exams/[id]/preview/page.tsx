'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { EXPERIENCE_LEVELS } from '@/components/admin/QuestionForm';
import { api, resolveApiAssetUrl } from '@/lib/api';
import type { ExamAnswerUpload, ExamQuestion, GeneratedExam } from '@/types';

const optionQuestionTypes = ['multiple_choice_single', 'multiple_choice_multiple', 'true_false'];
type DraftAnswer = { text?: string; optionIds?: string[]; upload?: ExamAnswerUpload };

const labelFor = (options: { value: string; label: string }[], value?: string) =>
  options.find((option) => option.value === value)?.label || value || '';

export default function ExamCandidatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addToast } = useToast();
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      try {
        const [examResponse, previewQuestions] = await Promise.all([
          api.getExam(id),
          api.getExamPreviewQuestions(id),
        ]);
        setExam(examResponse.data);
        setQuestions(previewQuestions);
        setCurrentIndex(0);
      } catch {
        addToast({ type: 'error', title: 'Failed to load exam preview' });
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [id, addToast]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = useMemo(() => Object.values(answers).filter((answer) =>
    (answer.text && answer.text.trim()) || (answer.optionIds && answer.optionIds.length > 0) || answer.upload
  ).length, [answers]);
  const isAnswered = (answer?: DraftAnswer) => Boolean(answer?.text?.trim() || (answer?.optionIds && answer.optionIds.length > 0) || answer?.upload);
  const hasOptions = (question: ExamQuestion) => optionQuestionTypes.includes(question.questionType) && question.options.length > 0;

  const updateTextAnswer = (question: ExamQuestion, text: string) => {
    setAnswers((value) => ({
      ...value,
      [question.examQuestionId]: { ...value[question.examQuestionId], text },
    }));
  };

  const updateOptionAnswer = (question: ExamQuestion, optionId: string) => {
    const current = answers[question.examQuestionId]?.optionIds || [];
    const nextOptionIds = question.questionType === 'multiple_choice_multiple'
      ? current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      : [optionId];

    setAnswers((value) => ({
      ...value,
      [question.examQuestionId]: { ...value[question.examQuestionId], optionIds: nextOptionIds },
    }));
  };

  const previewSolution = (question: ExamQuestion, file?: File) => {
    if (!file) return;
    setAnswers((value) => ({
      ...value,
      [question.examQuestionId]: {
        ...value[question.examQuestionId],
        upload: { fileName: file.name, fileUrl: URL.createObjectURL(file) },
      },
    }));
  };

  const removePreviewSolution = (question: ExamQuestion) => {
    setAnswers((value) => ({
      ...value,
      [question.examQuestionId]: { ...value[question.examQuestionId], upload: undefined },
    }));
  };

  if (loading) {
    return <LoadingOverlay message="Loading candidate preview..." />;
  }

  if (!exam) {
    return (
      <div className="page-content">
        <div className="card submitted-card">
          <h1>Exam Not Found</h1>
          <p>This exam preview could not be loaded.</p>
        </div>
      </div>
    );
  }

  const answer = currentQuestion ? answers[currentQuestion.examQuestionId] || {} : {};
  const currentQuestionHasOptions = currentQuestion ? hasOptions(currentQuestion) : false;

  return (
    <>
      <Header
        title="Candidate Exam Preview"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Candidates', href: '/admin/candidates' },
          { label: 'Exam Preview' },
        ]}
        actions={
          <div className="admin-panel-actions">
            <Link href="/admin/candidates">
              <Button variant="secondary">Back to Candidates</Button>
            </Link>
          </div>
        }
      />

      <div className="exam-layout admin-test-preview">
        <div className="exam-header admin-test-preview-header">
          <div>
            <span className="admin-eyebrow">Candidate Test View</span>
            <h2>{exam.title}</h2>
            <p className="admin-muted-cell">
              {exam.candidateName} - {labelFor(EXPERIENCE_LEVELS, exam.experienceLevel)}
            </p>
          </div>
          <div className="exam-timer">
            <span>{answeredCount}/{questions.length}</span>
            <span>answered</span>
          </div>
        </div>
        <div className="exam-progress-bar">
          <div className="exam-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <main className="exam-content">
          {currentQuestion ? (
            <div className="exam-question-card">
              <div className="exam-question-header">
                <span className="exam-question-number">Question {currentIndex + 1} of {questions.length}</span>
                <div className="exam-question-meta">
                  <Badge variant="blue">{currentQuestion.points} pts</Badge>
                </div>
              </div>

              <div className="exam-question-text">{currentQuestion.questionText}</div>

              {currentQuestion.questionImageUrl && (
                <img
                  className="exam-question-image"
                  src={resolveApiAssetUrl(currentQuestion.questionImageUrl)}
                  alt="Question reference"
                />
              )}

              {currentQuestionHasOptions ? (
                <div className="exam-options">
                  {currentQuestion.options.map((option) => {
                    const selected = (answer.optionIds || []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`exam-option ${selected ? 'exam-option-selected' : ''}`}
                        onClick={() => updateOptionAnswer(currentQuestion, option.id)}
                      >
                        <span className={currentQuestion.questionType === 'multiple_choice_multiple' ? 'exam-option-checkbox' : 'exam-option-radio'} />
                        <span className="exam-option-text">{option.optionText}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="exam-solution-area">
                  <div className="form-group">
                    <label className="form-label">Written Answer</label>
                    <textarea
                      className="form-input form-textarea"
                      placeholder="A candidate would type their response here..."
                      value={answer.text || ''}
                      onChange={(event) => updateTextAnswer(currentQuestion, event.target.value)}
                    />
                  </div>

                  <div className="solution-upload-panel">
                    <label className="form-label">Upload PDF/Image Solution</label>
                    <input
                      className="form-input"
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                      onChange={(event) => previewSolution(currentQuestion, event.target.files?.[0])}
                    />
                    <div className="form-hint">Candidate can attach a marked-up image, drawing, calculation sheet, or PDF. Maximum 10 MB.</div>
                    {answer.upload && (
                      <div className="solution-upload-preview">
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(answer.upload.fileName) ? (
                          <img src={answer.upload.fileUrl} alt="Uploaded solution preview" />
                        ) : (
                          <div className="solution-upload-file">PDF</div>
                        )}
                        <div>
                          <strong>{answer.upload.fileName}</strong>
                          <span>Preview upload only</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removePreviewSolution(currentQuestion)}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="exam-navigation">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                >
                  Previous
                </Button>
                {currentIndex < questions.length - 1 ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="button" variant="primary" disabled>
                    Submit Preview
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="exam-question-card">
              <h2>No Questions Available</h2>
              <p>This generated exam does not currently include questions.</p>
            </div>
          )}

          <div className="exam-question-nav">
            {questions.map((question, index) => (
              <button
                key={question.examQuestionId}
                type="button"
                className={`exam-question-nav-btn ${index === currentIndex ? 'exam-question-nav-btn-current' : ''} ${isAnswered(answers[question.examQuestionId]) ? 'exam-question-nav-btn-answered' : ''}`}
                onClick={() => setCurrentIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
