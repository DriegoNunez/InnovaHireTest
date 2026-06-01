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

function QuestionReview({ question }: { question: ExamResultQuestion }) {
  const selectedIds = useMemo(() => parseSelectedOptions(question.selectedOptionIds), [question.selectedOptionIds]);
  const attachment = parseAttachment(question.answerText);
  const textAnswer = answerWithoutAttachment(question.answerText);

  return (
    <Card>
      <div className="exam-question-header">
        <span className="exam-question-number">Question {question.displayOrder}</span>
        <div className="exam-question-meta">
          <Badge variant="blue">{question.points} pts</Badge>
          {question.pointsAwarded !== undefined && (
            <Badge variant="success">{question.pointsAwarded}/{question.maxPoints || question.points} scored</Badge>
          )}
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
    </Card>
  );
}

export default function ResultDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);

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
          <Link href="/admin/results">
            <Button type="button" variant="secondary">Back to Results</Button>
          </Link>
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

        <div className="result-question-list">
          {(result.questions || []).map((question) => (
            <QuestionReview key={question.examQuestionId} question={question} />
          ))}
        </div>
      </div>
    </>
  );
}
