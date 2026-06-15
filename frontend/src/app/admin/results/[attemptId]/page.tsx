'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { api, resolveApiAssetUrl } from '@/lib/api';
import type { ExamResult, ExamResultQuestion } from '@/types';

const LAS_VEGAS_TIMEZONE = 'America/Los_Angeles';

const formatLasVegasDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    timeZone: LAS_VEGAS_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

const parseSelectedOptions = (value?: string) => {
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
};

const parseAttachment = (answerText?: string) => {
  if (!answerText) return null;
  const match = answerText.match(/Attached solution:\s*(.+)\n(\/uploads\/answers\/[^\s]+)/);
  if (!match) return null;
  return { fileName: match[1], fileUrl: match[2] };
};

const answerWithoutAttachment = (answerText?: string) => {
  if (!answerText) return '';
  return answerText.replace(/\n*\s*Attached solution:\s*.+\n\/uploads\/answers\/[^\s]+/m, '').trim();
};

const optionText = (question: ExamResultQuestion, optionIds: string[]) =>
  question.options
    .filter((option) => optionIds.includes(option.id))
    .map((option) => option.optionText)
    .join(', ');

function SolvedQuestion({ question }: { question: ExamResultQuestion }) {
  const selectedIds = parseSelectedOptions(question.selectedOptionIds);
  const correctIds = question.options.filter((option) => option.isCorrect).map((option) => option.id);
  const attachment = parseAttachment(question.answerText);
  const textAnswer = answerWithoutAttachment(question.answerText);
  const selectedAnswer = optionText(question, selectedIds);
  const correctAnswer = optionText(question, correctIds);

  return (
    <article className="solved-question">
      <div className="solved-question-header">
        <h3>Question {question.displayOrder}</h3>
        <span>{question.pointsAwarded ?? 0}/{question.maxPoints || question.points} points</span>
      </div>

      <p className="solved-question-text">{question.questionText}</p>

      {question.questionImageUrl && (
        <img
          className="solved-question-image"
          src={resolveApiAssetUrl(question.questionImageUrl)}
          alt="Question reference"
        />
      )}

      <div className="solved-answer-grid">
        <div>
          <label>Candidate Answer</label>
          <p>{selectedAnswer || textAnswer || (attachment ? attachment.fileName : 'No answer submitted')}</p>
        </div>
        <div>
          <label>Correct Answer</label>
          <p>{correctAnswer || 'Rubric-based review'}</p>
        </div>
      </div>

      {question.aiFeedback && (
        <div className="solved-feedback">
          <label>Feedback</label>
          <p>{question.aiFeedback}</p>
        </div>
      )}
    </article>
  );
}

function QuestionReview({
  question,
  attemptId,
  onSaved,
}: {
  question: ExamResultQuestion;
  attemptId: string;
  onSaved: (result: ExamResult) => void;
}) {
  const selectedIds = useMemo(() => parseSelectedOptions(question.selectedOptionIds), [question.selectedOptionIds]);
  const attachment = parseAttachment(question.answerText);
  const textAnswer = answerWithoutAttachment(question.answerText);
  const [pointsAwarded, setPointsAwarded] = useState(question.pointsAwarded ?? 0);
  const [feedback, setFeedback] = useState(question.aiFeedback || '');
  const [overrideReason, setOverrideReason] = useState(question.overrideReason || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPointsAwarded(question.pointsAwarded ?? 0);
    setFeedback(question.aiFeedback || '');
    setOverrideReason(question.overrideReason || '');
  }, [question]);

  const saveGrade = async () => {
    setSaving(true);
    try {
      const response = await api.updateQuestionGrade(attemptId, {
        examQuestionId: question.examQuestionId,
        pointsAwarded,
        feedback,
        overrideReason,
      });
      onSaved(response.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="exam-question-header">
        <span className="exam-question-number">Question {question.displayOrder}</span>
        <div className="exam-question-meta">
          <Badge variant="blue">{question.points} pts</Badge>
          {question.pointsAwarded !== undefined && (
            <Badge variant="success">{question.pointsAwarded}/{question.maxPoints || question.points} scored</Badge>
          )}
          {question.isOverridden ? (
            <Badge variant="warning">Human Edited</Badge>
          ) : question.isAutoGraded ? (
            <Badge variant="info">AI Draft</Badge>
          ) : null}
        </div>
      </div>

      <div className="exam-question-text">{question.questionText}</div>

      {question.questionImageUrl && (
        <img
          className="exam-question-image"
          src={resolveApiAssetUrl(question.questionImageUrl)}
          alt="Question reference"
        />
      )}

      {question.options.length > 0 && (
        <div className="exam-options result-review-options">
          {question.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <div
                key={option.id}
                className={`exam-option ${selected ? 'exam-option-selected' : ''} ${option.isCorrect ? 'result-option-correct' : ''}`}
              >
                <span className="exam-option-checkbox" />
                <span className="exam-option-text">
                  {option.optionText}
                  {selected && <strong> Selected</strong>}
                  {option.isCorrect && <strong> Correct</strong>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(textAnswer || attachment) && (
        <div className="result-answer-panel">
          <label className="form-label">Candidate Answer</label>
          {textAnswer && <p>{textAnswer}</p>}
          {attachment && (
            <div className="solution-upload-preview">
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(attachment.fileUrl) ? (
                <img src={resolveApiAssetUrl(attachment.fileUrl)} alt="Uploaded solution" />
              ) : (
                <div className="solution-upload-file">PDF</div>
              )}
              <div>
                <strong>{attachment.fileName}</strong>
                <a href={resolveApiAssetUrl(attachment.fileUrl)} target="_blank" rel="noreferrer">
                  View upload
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {question.answeredAt && (
        <div className="form-hint">Answered {formatLasVegasDate(question.answeredAt)}</div>
      )}
      {question.aiFeedback && (
        <div className="result-answer-panel">
          <label className="form-label">AI Feedback</label>
          <p>{question.aiFeedback}</p>
        </div>
      )}

      <div className="grading-review-panel">
        <div>
          <span className="admin-eyebrow">Grading Review</span>
          <h3>AI draft, human editable</h3>
        </div>
        <div className="grading-review-grid">
          <div className="form-group">
            <label className="form-label">Points Awarded</label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={question.points}
              value={pointsAwarded}
              onChange={(event) => setPointsAwarded(Number(event.target.value))}
            />
            <div className="form-hint">Maximum {question.points} points</div>
          </div>
          <div className="form-group">
            <label className="form-label">Override Reason</label>
            <input
              className="form-input"
              value={overrideReason}
              placeholder="Optional note for human adjustment"
              onChange={(event) => setOverrideReason(event.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Feedback</label>
          <textarea
            className="form-input form-textarea"
            value={feedback}
            placeholder="AI feedback or human reviewer notes"
            onChange={(event) => setFeedback(event.target.value)}
          />
        </div>
        <div className="grading-review-actions">
          <Button type="button" variant="primary" size="sm" isLoading={saving} onClick={saveGrade}>
            Save Human Review
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ResultDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    const loadResult = async () => {
      setLoading(true);
      try {
        const response = await api.getResult(attemptId);
        setResult(response.data);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [attemptId]);

  const generateAiGrades = async () => {
    setGrading(true);
    try {
      const response = await api.generateAiGrades(attemptId);
      setResult(response.data);
    } finally {
      setGrading(false);
    }
  };

  const downloadSolvedExamPdf = () => {
    window.print();
  };

  if (loading) {
    return <LoadingOverlay message="Loading exam..." />;
  }

  if (!result) {
    return (
      <div className="page-content">
        <Card>
          <h3>Exam not found</h3>
        </Card>
      </div>
    );
  }

  const { attempt } = result;

  return (
    <>
      <Header
        title="Completed Exam"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Completed Exams', href: '/admin/results' },
          { label: 'View Exam' },
        ]}
        actions={
          <>
            <Button type="button" variant="primary" isLoading={grading} onClick={generateAiGrades}>
              Generate AI Draft
            </Button>
            <Button type="button" variant="secondary" onClick={downloadSolvedExamPdf}>
              Download Solved Exam PDF
            </Button>
            <Link href="/admin/results">
              <Button type="button" variant="secondary">Back to Results</Button>
            </Link>
          </>
        }
      />

      <div className="page-content">
        <Card>
          <div className="result-detail-header">
            <div>
              <span className="admin-eyebrow">Candidate</span>
              <h2>{attempt.candidateName || 'Candidate'}</h2>
              <p className="admin-muted-cell">{attempt.candidateEmail}</p>
            </div>
            <StatusBadge status={attempt.status} />
          </div>
          <div className="candidate-detail-grid">
            <div>
              <label className="form-label">Exam</label>
              <strong>{attempt.examTitle}</strong>
            </div>
            <div>
              <label className="form-label">Started (Las Vegas)</label>
              <strong>{formatLasVegasDate(attempt.startedAt)}</strong>
            </div>
            <div>
              <label className="form-label">Submitted (Las Vegas)</label>
              <strong>{formatLasVegasDate(attempt.submittedAt || attempt.completedAt)}</strong>
            </div>
            <div>
              <label className="form-label">Score</label>
              <strong>{attempt.percentageScore !== undefined ? `${Number(attempt.percentageScore).toFixed(1)}%` : 'Pending'}</strong>
            </div>
          </div>
        </Card>

        <section id="solved-exam" className="solved-exam-print-area">
          <Card>
            <div className="solved-exam-header">
              <div>
                <span className="admin-eyebrow">Solved Exam</span>
                <h2>{attempt.examTitle}</h2>
                <p>{attempt.candidateName || 'Candidate'} - {attempt.candidateEmail}</p>
              </div>
              <div className="solved-exam-score">
                <strong>{attempt.percentageScore !== undefined ? `${Number(attempt.percentageScore).toFixed(1)}%` : 'Pending'}</strong>
                <span>{attempt.totalScore ?? 0}/{attempt.maxScore || result.maxScore} points</span>
              </div>
            </div>
            <div className="solved-exam-actions">
              <Button type="button" variant="primary" onClick={downloadSolvedExamPdf}>
                Download PDF
              </Button>
            </div>
          </Card>

          <div className="solved-question-list">
            {(result.questions || []).map((question) => (
              <SolvedQuestion key={question.examQuestionId} question={question} />
            ))}
          </div>
        </section>

        <Card>
          <div className="ai-grading-summary">
            <div>
              <span className="admin-eyebrow">AI Grading</span>
              <h3>Draft scores with human review</h3>
              <p>
                Generate draft scores first, then adjust points and feedback per question before using the result for hiring decisions.
              </p>
            </div>
            <Button type="button" variant="primary" isLoading={grading} onClick={generateAiGrades}>
              Generate AI Draft
            </Button>
          </div>
        </Card>

        <div className="result-question-list">
          {(result.questions || []).map((question) => (
            <QuestionReview
              key={question.examQuestionId}
              question={question}
              attemptId={attemptId}
              onSaved={setResult}
            />
          ))}
        </div>
      </div>
    </>
  );
}
