'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { api, resolveApiAssetUrl } from '@/lib/api';
import type { ExamAnswerUpload, ExamQuestion, ExamSession } from '@/types';

const optionQuestionTypes = ['multiple_choice_single', 'multiple_choice_multiple', 'true_false'];
type DraftAnswer = { text?: string; optionIds?: string[]; upload?: ExamAnswerUpload };

export default function CandidateExamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const validate = async () => {
      setLoading(true);
      try {
        const result = await api.validateExamToken(token);
        if (!result.isValid) {
          setError('This test link is invalid or has expired.');
          return;
        }
        setCandidateName(result.candidateName || '');
        setExamTitle(result.examTitle || 'INNOVA Structural Engineering Exam');
      } catch {
        setError('Could not validate this test link.');
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [token]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = useMemo(() => Object.values(answers).filter((answer) =>
    (answer.text && answer.text.trim()) || (answer.optionIds && answer.optionIds.length > 0) || answer.upload
  ).length, [answers]);

  const composeAnswerText = (answer?: DraftAnswer) => {
    const parts = [];
    if (answer?.text?.trim()) parts.push(answer.text.trim());
    if (answer?.upload) {
      parts.push(`Attached solution: ${answer.upload.fileName}\n${answer.upload.fileUrl}`);
    }
    return parts.join('\n\n');
  };

  const isAnswered = (answer?: DraftAnswer) => Boolean(answer?.text?.trim() || (answer?.optionIds && answer.optionIds.length > 0) || answer?.upload);
  const hasOptions = (question: ExamQuestion) => optionQuestionTypes.includes(question.questionType) && question.options.length > 0;

  const startExam = async () => {
    setStarting(true);
    try {
      const nextSession = await api.startExam(token);
      const nextQuestions = await api.getExamQuestions(nextSession.attemptId);
      setSession(nextSession);
      setQuestions(nextQuestions);
      setCurrentIndex(0);
    } catch {
      setError('Could not start the test.');
    } finally {
      setStarting(false);
    }
  };

  const updateTextAnswer = (question: ExamQuestion, text: string) => {
    setAnswers((value) => ({
      ...value,
      [question.examQuestionId]: { ...value[question.examQuestionId], text },
    }));
  };

  const updateOptionAnswer = async (question: ExamQuestion, optionId: string) => {
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

    if (session) {
      await api.submitExamAnswer(session.attemptId, {
        examQuestionId: question.examQuestionId,
        selectedOptionIds: nextOptionIds,
        timeSpentSeconds: 0,
      }).catch(() => undefined);
    }
  };

  const saveTextAnswer = async (question: ExamQuestion) => {
    if (!session) return;
    await api.submitExamAnswer(session.attemptId, {
      examQuestionId: question.examQuestionId,
      answerText: composeAnswerText(answers[question.examQuestionId]),
      timeSpentSeconds: 0,
    }).catch(() => undefined);
  };

  const uploadSolution = async (question: ExamQuestion, file?: File) => {
    if (!session || !file) return;

    setUploadingQuestionId(question.examQuestionId);
    setUploadErrors((current) => ({ ...current, [question.examQuestionId]: '' }));

    try {
      const upload = await api.uploadExamAnswerFile(session.attemptId, file);
      const nextAnswer = { ...answers[question.examQuestionId], upload };
      setAnswers((value) => ({
        ...value,
        [question.examQuestionId]: nextAnswer,
      }));
      await api.submitExamAnswer(session.attemptId, {
        examQuestionId: question.examQuestionId,
        answerText: composeAnswerText(nextAnswer),
        timeSpentSeconds: 0,
      });
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Could not upload the solution file.';
      setUploadErrors((current) => ({ ...current, [question.examQuestionId]: message }));
    } finally {
      setUploadingQuestionId(null);
    }
  };

  const removeSolution = async (question: ExamQuestion) => {
    if (!session) return;
    const nextAnswer = { ...answers[question.examQuestionId], upload: undefined };
    setAnswers((value) => ({
      ...value,
      [question.examQuestionId]: nextAnswer,
    }));
    await api.submitExamAnswer(session.attemptId, {
      examQuestionId: question.examQuestionId,
      answerText: composeAnswerText(nextAnswer),
      timeSpentSeconds: 0,
    }).catch(() => undefined);
  };

  const submitExam = async () => {
    if (!session) return;

    const missingAnswer = questions.find((question) => !isAnswered(answers[question.examQuestionId]));

    if (missingAnswer) {
      setSubmitError(hasOptions(missingAnswer)
        ? `Please select an option for question ${missingAnswer.displayOrder}.`
        : `Please write an answer or upload a PDF/image for question ${missingAnswer.displayOrder}.`);
      setCurrentIndex(Math.max(0, questions.indexOf(missingAnswer)));
      return;
    }

    setSubmitError('');
    setSubmitting(true);
    try {
      for (const question of questions) {
        const answer = answers[question.examQuestionId];
        if (answer?.optionIds && answer.optionIds.length > 0) {
          await api.submitExamAnswer(session.attemptId, {
            examQuestionId: question.examQuestionId,
            selectedOptionIds: answer.optionIds,
            timeSpentSeconds: 0,
          });
        } else if (answer?.text !== undefined || answer?.upload) {
          await api.submitExamAnswer(session.attemptId, {
            examQuestionId: question.examQuestionId,
            answerText: composeAnswerText(answer),
            timeSpentSeconds: 0,
          });
        }
      }
      await api.submitExamAttempt(session.attemptId);
      setSubmitted(true);
    } catch {
      setError('Could not submit the test.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingOverlay fullPage message="Checking test link..." />;
  }

  if (error) {
    return (
      <div className="submitted-page">
        <div className="card submitted-card">
          <h1>Test Unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="submitted-page">
        <div className="card submitted-card">
          <div className="submitted-icon">OK</div>
          <h1>Test Submitted</h1>
          <p>Your responses have been submitted. The hiring team can now review your test.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="exam-rules-page">
        <div className="card exam-rules-card">
          <h1>{examTitle}</h1>
          <p className="exam-rules-subtitle">{candidateName ? `Candidate: ${candidateName}` : 'Candidate test link'}</p>
          <div className="exam-rules-info">
            <div>
              <span>Assessment</span>
              <strong>Complete in one sitting</strong>
            </div>
            <div>
              <span>Auto-saved</span>
              <strong>Answers save as you move</strong>
            </div>
          </div>
          <div className="admin-form-actions">
            <Button type="button" variant="primary" size="lg" isLoading={starting} onClick={startExam}>
              Start Test
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="submitted-page">
        <div className="card submitted-card">
          <h1>No Questions Available</h1>
          <p>This test does not currently include questions.</p>
        </div>
      </div>
    );
  }

  const answer = answers[currentQuestion.examQuestionId] || {};
  const currentQuestionHasOptions = hasOptions(currentQuestion);

  return (
    <div className="exam-layout">
      <div className="exam-header">
        <div>
          <span className="admin-eyebrow">INNOVA Exam</span>
          <h2>{session.title}</h2>
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
        <div className="exam-question-card">
          <div className="exam-question-header">
            <span className="exam-question-number">Question {currentIndex + 1} of {questions.length}</span>
            <div className="exam-question-meta">
              <span className="badge badge-blue">{currentQuestion.points} pts</span>
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
                  value={answer.text || ''}
                  onChange={(event) => updateTextAnswer(currentQuestion, event.target.value)}
                  onBlur={() => saveTextAnswer(currentQuestion)}
                />
              </div>

              <div className="solution-upload-panel">
                <label className="form-label">Upload PDF/Image Solution</label>
                <input
                  className="form-input"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                  disabled={uploadingQuestionId === currentQuestion.examQuestionId}
                  onChange={(event) => uploadSolution(currentQuestion, event.target.files?.[0])}
                />
                <div className="form-hint">
                  {uploadingQuestionId === currentQuestion.examQuestionId
                    ? 'Uploading solution...'
                    : 'Attach a marked-up image, drawing, calculation sheet, or PDF. Maximum 10 MB.'}
                </div>
                {uploadErrors[currentQuestion.examQuestionId] && (
                  <div className="form-error">{uploadErrors[currentQuestion.examQuestionId]}</div>
                )}
                {answer.upload && (
                  <div className="solution-upload-preview">
                    {/\.(jpg|jpeg|png|gif|webp)$/i.test(answer.upload.fileName) || /\.(jpg|jpeg|png|gif|webp)$/i.test(answer.upload.fileUrl) ? (
                      <img src={resolveApiAssetUrl(answer.upload.fileUrl)} alt="Uploaded solution" />
                    ) : (
                      <div className="solution-upload-file">PDF</div>
                    )}
                    <div>
                      <strong>{answer.upload.fileName}</strong>
                      <a href={resolveApiAssetUrl(answer.upload.fileUrl)} target="_blank" rel="noreferrer">
                        View upload
                      </a>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSolution(currentQuestion)}>
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
              <Button type="button" variant="primary" isLoading={submitting} onClick={submitExam}>
                Submit Test
              </Button>
            )}
          </div>
          {submitError && <div className="form-error exam-submit-error">{submitError}</div>}
        </div>

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
  );
}
