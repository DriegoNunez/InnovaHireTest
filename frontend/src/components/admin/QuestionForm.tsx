'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { QuestionCategoryOption, QuestionFormData, QuestionType } from '@/types';

export const QUESTION_TYPES = [
  { value: 'multiple_choice_single', label: 'Multiple Choice' },
  { value: 'multiple_choice_multiple', label: 'Multi Select' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'long_technical', label: 'Long Technical' },
  { value: 'calculation_problem', label: 'Calculation Problem' },
  { value: 'structural_design', label: 'Structural Design' },
  { value: 'drawing_interpretation', label: 'Drawing Interpretation' },
  { value: 'code_interpretation', label: 'Code Interpretation' },
];

export const DIFFICULTIES = [
  { value: 'level1', label: 'Level 1' },
  { value: 'level2', label: 'Level 2' },
  { value: 'level3', label: 'Level 3' },
  { value: 'level4', label: 'Level 4' },
  { value: 'level5', label: 'Level 5' },
];

export const EXPERIENCE_LEVELS = [
  { value: 'entry_level', label: 'Entry Level' },
  { value: 'pe', label: 'PE' },
  { value: 'senior_engineer', label: 'Senior Engineer' },
];

export const QUESTION_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export const FALLBACK_CATEGORIES: QuestionCategoryOption[] = [
  { id: '44444444-0001-0001-0001-000000000001', name: 'Structural Engineering Fundamentals', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000002', name: 'Steel Design', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000003', name: 'Concrete Design', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000004', name: 'ASCE 7 Loading', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000005', name: 'IBC Code Knowledge', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000006', name: 'Structural Analysis', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000007', name: 'Engineering Judgment', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000008', name: 'Drawing Interpretation', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-000000000009', name: 'Construction Documents', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-00000000000a', name: 'QA/QC', isActive: true, questionCount: 0 },
  { id: '44444444-0001-0001-0001-00000000000b', name: 'Technical Communication', isActive: true, questionCount: 0 },
];

export function createBlankQuestionForm(categories = FALLBACK_CATEGORIES): QuestionFormData {
  return {
    categoryId: categories[0]?.id,
    text: '',
    type: 'multiple_choice_single',
    category: categories[0]?.name || 'Structural Engineering Fundamentals',
    difficulty: 'level3',
    experienceLevel: 'entry_level',
    status: 'draft',
    points: 10,
    timeLimit: 300,
    imageUrl: '',
    options: [
      { text: '', isCorrect: false, order: 1 },
      { text: '', isCorrect: false, order: 2 },
      { text: '', isCorrect: false, order: 3 },
      { text: '', isCorrect: false, order: 4 },
    ],
    rubric: [],
    explanation: '',
    tags: [],
    isActive: false,
  };
}

interface QuestionFormProps {
  initialValue: QuestionFormData;
  categories: QuestionCategoryOption[];
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (data: QuestionFormData) => Promise<void>;
  onCancel: () => void;
}

const optionQuestionTypes = ['multiple_choice_single', 'multiple_choice_multiple', 'true_false'];
const rubricQuestionTypes = ['short_answer', 'long_technical', 'calculation_problem', 'structural_design', 'drawing_interpretation', 'code_interpretation'];

const labelFor = (options: { value: string; label: string }[], value?: string) =>
  options.find((option) => option.value === value)?.label || value || '';

export function QuestionForm({
  initialValue,
  categories,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: QuestionFormProps) {
  const [form, setForm] = useState<QuestionFormData>(initialValue);
  const [tagInput, setTagInput] = useState('');

  const activeCategories = categories.length > 0 ? categories : FALLBACK_CATEGORIES;
  const needsOptions = optionQuestionTypes.includes(form.type);
  const needsRubric = rubricQuestionTypes.includes(form.type);
  const rubricTotal = useMemo(
    () => (form.rubric || []).reduce((total, item) => total + (Number(item.maxScore) || 0), 0),
    [form.rubric]
  );

  const updateForm = (field: keyof QuestionFormData, value: QuestionFormData[keyof QuestionFormData]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = activeCategories.find((item) => item.id === categoryId);
    setForm((prev) => ({
      ...prev,
      categoryId,
      category: category?.name || prev.category,
    }));
  };

  const handleTypeChange = (type: QuestionType) => {
    setForm((prev) => {
      const next = { ...prev, type };
      if (type === 'true_false') {
        next.options = [
          { text: 'True', isCorrect: true, order: 1 },
          { text: 'False', isCorrect: false, order: 2 },
        ];
      } else if (optionQuestionTypes.includes(type) && (!prev.options || prev.options.length === 0)) {
        next.options = [
          { text: '', isCorrect: false, order: 1 },
          { text: '', isCorrect: false, order: 2 },
          { text: '', isCorrect: false, order: 3 },
          { text: '', isCorrect: false, order: 4 },
        ];
      }
      return next;
    });
  };

  const addOption = () => {
    updateForm('options', [
      ...(form.options || []),
      { text: '', isCorrect: false, order: (form.options?.length || 0) + 1 },
    ]);
  };

  const updateOption = (index: number, field: 'text' | 'isCorrect', value: string | boolean) => {
    const nextOptions = [...(form.options || [])];
    nextOptions[index] = { ...nextOptions[index], [field]: value };
    if (form.type === 'multiple_choice_single' && field === 'isCorrect' && value) {
      nextOptions.forEach((option, optionIndex) => {
        if (optionIndex !== index) option.isCorrect = false;
      });
    }
    updateForm('options', nextOptions);
  };

  const removeOption = (index: number) => {
    updateForm(
      'options',
      (form.options || [])
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({ ...option, order: optionIndex + 1 }))
    );
  };

  const addRubric = () => {
    updateForm('rubric', [
      ...(form.rubric || []),
      { name: '', description: '', maxScore: 5, weight: 5, order: (form.rubric?.length || 0) + 1 },
    ]);
  };

  const updateRubric = (index: number, field: 'name' | 'description' | 'maxScore', value: string | number) => {
    const nextRubric = [...(form.rubric || [])];
    nextRubric[index] = {
      ...nextRubric[index],
      [field]: value,
      ...(field === 'maxScore' ? { weight: Number(value) } : {}),
    };
    updateForm('rubric', nextRubric);
  };

  const removeRubric = (index: number) => {
    updateForm(
      'rubric',
      (form.rubric || [])
        .filter((_, rubricIndex) => rubricIndex !== index)
        .map((criterion, rubricIndex) => ({ ...criterion, order: rubricIndex + 1 }))
    );
  };

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !form.tags.includes(trimmed)) {
      updateForm('tags', [...form.tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    updateForm('tags', form.tags.filter((item) => item !== tag));
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      isActive: form.status === 'published',
      options: needsOptions ? form.options : [],
      rubric: needsRubric ? form.rubric : [],
    });
  };

  return (
    <form className="admin-question-workspace" onSubmit={submitForm}>
      <div className="admin-question-main">
        <Card>
          <div className="question-form">
            <Textarea
              label="Question Prompt"
              required
              placeholder="Enter the structural engineering question..."
              value={form.text}
              onChange={(event) => updateForm('text', event.target.value)}
            />

            <div className="question-form-row">
              <Select
                label="Category"
                required
                options={activeCategories.map((category) => ({ value: category.id, label: category.name }))}
                value={form.categoryId || ''}
                onChange={(event) => handleCategoryChange(event.target.value)}
              />
              <Select
                label="Question Type"
                required
                options={QUESTION_TYPES}
                value={form.type}
                onChange={(event) => handleTypeChange(event.target.value as QuestionType)}
              />
              <Select
                label="Difficulty"
                required
                options={DIFFICULTIES}
                value={form.difficulty}
                onChange={(event) => updateForm('difficulty', event.target.value)}
              />
            </div>

            <div className="question-form-row">
              <Select
                label="Experience Level"
                required
                options={EXPERIENCE_LEVELS}
                value={form.experienceLevel || 'entry_level'}
                onChange={(event) => updateForm('experienceLevel', event.target.value)}
              />
              <Input
                label="Points"
                type="number"
                required
                min={1}
                value={form.points}
                onChange={(event) => updateForm('points', Number(event.target.value))}
              />
              <Input
                label="Time Limit"
                type="number"
                min={0}
                value={form.timeLimit || ''}
                onChange={(event) => updateForm('timeLimit', event.target.value ? Number(event.target.value) : undefined)}
                hint="Seconds. Use 0 or blank for no per-question limit."
              />
            </div>

            <div className="question-form-row">
              <Select
                label="Status"
                required
                options={QUESTION_STATUSES}
                value={form.status || 'draft'}
                onChange={(event) => updateForm('status', event.target.value)}
              />
              <Input
                label="Reference Image URL"
                value={form.imageUrl || ''}
                onChange={(event) => updateForm('imageUrl', event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </Card>

        {needsOptions && (
          <Card>
            <div className="admin-panel-heading">
              <div>
                <h3>Answer Options</h3>
                <p>Mark the correct option for auto-graded objective questions.</p>
              </div>
              {form.type !== 'true_false' && (
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  Add Option
                </Button>
              )}
            </div>
            <div className="options-editor">
              {(form.options || []).map((option, index) => (
                <div key={index} className={`option-item ${option.isCorrect ? 'option-item-correct' : ''}`}>
                  <input
                    type={form.type === 'multiple_choice_multiple' ? 'checkbox' : 'radio'}
                    name="correct-option"
                    checked={option.isCorrect}
                    onChange={(event) => updateOption(index, 'isCorrect', event.target.checked)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Option ${index + 1}`}
                    value={option.text}
                    onChange={(event) => updateOption(index, 'text', event.target.value)}
                  />
                  {form.type !== 'true_false' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(index)}
                      disabled={(form.options || []).length <= 2}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {needsRubric && (
          <Card>
            <div className="admin-panel-heading">
              <div>
                <h3>AI Grading Rubric</h3>
                <p>Define the criteria the grading agent should score for subjective answers.</p>
              </div>
              <div className="admin-panel-actions">
                <span className="admin-total-pill">{rubricTotal} pts</span>
                <Button type="button" variant="outline" size="sm" onClick={addRubric}>
                  Add Criterion
                </Button>
              </div>
            </div>
            <div className="rubric-editor">
              {(form.rubric || []).map((criterion, index) => (
                <div key={index} className="rubric-item">
                  <div className="question-form-row">
                    <Input
                      label={`Criterion ${index + 1}`}
                      placeholder="Code compliance"
                      value={criterion.name}
                      onChange={(event) => updateRubric(index, 'name', event.target.value)}
                    />
                    <Input
                      label="Max Points"
                      type="number"
                      min={1}
                      value={criterion.maxScore}
                      onChange={(event) => updateRubric(index, 'maxScore', Number(event.target.value))}
                    />
                  </div>
                  <Textarea
                    label="Grading Guidance"
                    placeholder="Describe what a full-credit answer must include..."
                    value={criterion.description}
                    onChange={(event) => updateRubric(index, 'description', event.target.value)}
                    style={{ minHeight: '72px' }}
                  />
                  <div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRubric(index)}>
                      Remove Criterion
                    </Button>
                  </div>
                </div>
              ))}
              {(form.rubric || []).length === 0 && (
                <div className="admin-empty-inline">
                  No rubric criteria yet. Add criteria before publishing subjective questions.
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div className="question-form">
            <div className="form-group">
              <label className="form-label">Tags</label>
              <div className="tags-input">
                {form.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                    <button type="button" className="tag-remove" onClick={() => removeTag(tag)}>
                      x
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="Add tag and press Enter..."
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                />
              </div>
            </div>

            <Textarea
              label="Explanation"
              placeholder="Optional explanation for reviewers and future reports..."
              value={form.explanation || ''}
              onChange={(event) => updateForm('explanation', event.target.value)}
            />
          </div>
        </Card>
      </div>

      <aside className="admin-question-preview">
        <Card>
          <div className="admin-preview-header">
            <span className="admin-eyebrow">Preview</span>
            <span className={`admin-status-dot admin-status-${form.status || 'draft'}`} />
          </div>
          <h3>{form.text || 'Question prompt preview'}</h3>
          <div className="admin-preview-meta">
            <span>{form.category}</span>
            <span>{labelFor(QUESTION_TYPES, form.type)}</span>
            <span>{labelFor(DIFFICULTIES, form.difficulty)}</span>
            <span>{labelFor(EXPERIENCE_LEVELS, form.experienceLevel)}</span>
          </div>
          <div className="admin-preview-score">
            <strong>{form.points}</strong>
            <span>points</span>
            {form.timeLimit ? <span>{Math.round(form.timeLimit / 60)} min</span> : <span>No limit</span>}
          </div>
          {needsOptions && (
            <div className="admin-preview-list">
              {(form.options || []).map((option, index) => (
                <div key={index} className={option.isCorrect ? 'is-correct' : ''}>
                  {option.text || `Option ${index + 1}`}
                </div>
              ))}
            </div>
          )}
          {needsRubric && (
            <div className="admin-preview-list">
              {(form.rubric || []).map((criterion, index) => (
                <div key={index}>
                  <strong>{criterion.name || `Criterion ${index + 1}`}</strong>
                  <span>{criterion.maxScore} pts</span>
                </div>
              ))}
            </div>
          )}
          <div className="admin-form-actions">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        </Card>
      </aside>
    </form>
  );
}
