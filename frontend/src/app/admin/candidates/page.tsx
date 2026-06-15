'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { EXPERIENCE_LEVELS } from '@/components/admin/QuestionForm';
import { api } from '@/lib/api';
import type { Candidate, CandidateFilters, CandidateFormData, ExperienceLevel, GeneratedExam } from '@/types';

const blankCandidate: CandidateFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  experienceLevel: 'entry_level',
  yearsOfExperience: undefined,
  currentCompany: '',
  notes: '',
};

const labelFor = (options: { value: string; label: string }[], value?: string) =>
  options.find((option) => option.value === value)?.label || value || '';

const buildInviteLink = (exam: GeneratedExam) => {
  if (typeof window === 'undefined') return exam.invitationUrl;
  return `${window.location.origin}${exam.invitationUrl}`;
};

export default function CandidatesPage() {
  const { addToast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CandidateFilters>({ page: 1, limit: 10 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState<CandidateFormData>(blankCandidate);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [inviteForm, setInviteForm] = useState({
    experienceLevel: 'entry_level' as ExperienceLevel,
    timeLimitMinutes: 120,
    totalQuestions: 10,
  });
  const [generatedExam, setGeneratedExam] = useState<GeneratedExam | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true);
      try {
        const response = await api.getCandidates(filters);
        setCandidates(response.data);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      } catch {
        addToast({ type: 'error', title: 'Failed to load candidates' });
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [filters, addToast]);

  const stats = useMemo(() => ({
    total,
    entry: candidates.filter((candidate) => candidate.experienceLevel === 'entry_level').length,
    pe: candidates.filter((candidate) => candidate.experienceLevel === 'pe').length,
    senior: candidates.filter((candidate) => candidate.experienceLevel === 'senior_engineer').length,
  }), [candidates, total]);

  const updateCandidateForm = (field: keyof CandidateFormData, value: CandidateFormData[keyof CandidateFormData]) => {
    setCandidateForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateCandidate = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    try {
      const response = await api.createCandidate(candidateForm);
      setCandidates((current) => [response.data, ...current]);
      setTotal((current) => current + 1);
      setCandidateForm(blankCandidate);
      setIsCandidateModalOpen(false);
      addToast({ type: 'success', title: 'Candidate created' });
    } catch {
      addToast({ type: 'error', title: 'Failed to create candidate' });
    } finally {
      setIsCreating(false);
    }
  };

  const openInviteModal = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setGeneratedExam(null);
    setInviteForm({
      experienceLevel: candidate.experienceLevel || 'entry_level',
      timeLimitMinutes: 120,
      totalQuestions: 10,
    });
    setIsInviteModalOpen(true);
  };

  const handleGenerateInvite = async () => {
    if (!selectedCandidate) return;

    setBusyId(selectedCandidate.id);
    try {
      const response = await api.generateExam({
        candidateId: selectedCandidate.id,
        experienceLevel: inviteForm.experienceLevel,
        timeLimitMinutes: inviteForm.timeLimitMinutes,
        totalQuestions: inviteForm.totalQuestions,
      });
      await api.sendExamInvite(response.data.id);
      setGeneratedExam(response.data);
      addToast({ type: 'success', title: 'Test link generated' });
    } catch {
      addToast({ type: 'error', title: 'Could not generate test. Make sure published questions exist for this level.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveCandidate = async (candidate: Candidate) => {
    const name = `${candidate.firstName} ${candidate.lastName}`.trim() || 'this candidate';
    if (!window.confirm(`Remove ${name} from the candidate list?`)) return;

    setBusyId(candidate.id);
    try {
      await api.deleteCandidate(candidate.id);
      setCandidates((current) => current.filter((item) => item.id !== candidate.id));
      setTotal((current) => Math.max(0, current - 1));
      addToast({ type: 'success', title: 'Candidate removed' });
    } catch {
      addToast({ type: 'error', title: 'Failed to remove candidate' });
    } finally {
      setBusyId(null);
    }
  };

  const copyInviteLink = async () => {
    if (!generatedExam) return;
    await navigator.clipboard.writeText(buildInviteLink(generatedExam));
    addToast({ type: 'success', title: 'Invite link copied' });
  };

  const columns = [
    {
      key: 'name',
      header: 'Candidate',
      render: (candidate: Candidate) => (
        <div className="admin-table-question">
          <strong>{candidate.firstName} {candidate.lastName}</strong>
          <span className="admin-muted-cell">{candidate.email}</span>
        </div>
      ),
    },
    {
      key: 'experienceLevel',
      header: 'Level',
      render: (candidate: Candidate) => (
        <Badge variant="blue">{labelFor(EXPERIENCE_LEVELS, candidate.experienceLevel)}</Badge>
      ),
    },
    {
      key: 'yearsOfExperience',
      header: 'Years',
      render: (candidate: Candidate) => <span className="admin-muted-cell">{candidate.yearsOfExperience ?? '-'}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      render: (candidate: Candidate) => <span className="admin-muted-cell">{candidate.currentCompany || '-'}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '240px',
      render: (candidate: Candidate) => (
        <div className="table-actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busyId === candidate.id}
            onClick={() => openInviteModal(candidate)}
          >
            Send Test
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={busyId === candidate.id}
            onClick={() => handleRemoveCandidate(candidate)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Header
        title="Candidates"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Candidates' }]}
        actions={
          <Button type="button" variant="primary" onClick={() => setIsCandidateModalOpen(true)}>
            Add Candidate
          </Button>
        }
      />

      <div className="page-content">
        <div className="admin-summary-strip">
          <div>
            <span>{stats.total}</span>
            <label>Total Candidates</label>
          </div>
          <div>
            <span>{stats.entry}</span>
            <label>Entry Level</label>
          </div>
          <div>
            <span>{stats.pe}</span>
            <label>PE</label>
          </div>
          <div>
            <span>{stats.senior}</span>
            <label>Senior Engineer</label>
          </div>
        </div>

        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Input
              className="search-input"
              placeholder="Search candidates..."
              value={filters.search || ''}
              onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
            />
          </div>
          <Select
            options={EXPERIENCE_LEVELS}
            placeholder="All Levels"
            value={filters.experienceLevel || ''}
            onChange={(event) => setFilters({ ...filters, experienceLevel: event.target.value as ExperienceLevel, page: 1 })}
          />
        </div>

        <Table
          columns={columns}
          data={candidates}
          keyExtractor={(candidate) => candidate.id}
          isLoading={loading}
          emptyMessage="No candidates found. Add a candidate to send the first test."
          emptyIcon="ID"
          currentPage={filters.page || 1}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      </div>

      <Modal
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        title="Add Candidate"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsCandidateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="candidate-form" isLoading={isCreating}>
              Save Candidate
            </Button>
          </>
        }
      >
        <form id="candidate-form" className="candidate-form" onSubmit={handleCreateCandidate}>
          <div className="question-form-row">
            <Input
              label="First Name"
              required
              value={candidateForm.firstName}
              onChange={(event) => updateCandidateForm('firstName', event.target.value)}
            />
            <Input
              label="Last Name"
              required
              value={candidateForm.lastName}
              onChange={(event) => updateCandidateForm('lastName', event.target.value)}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={candidateForm.email}
            onChange={(event) => updateCandidateForm('email', event.target.value)}
          />
          <div className="question-form-row">
            <Input
              label="Phone"
              value={candidateForm.phone || ''}
              onChange={(event) => updateCandidateForm('phone', event.target.value)}
            />
            <Select
              label="Experience Level"
              required
              options={EXPERIENCE_LEVELS}
              value={candidateForm.experienceLevel}
              onChange={(event) => updateCandidateForm('experienceLevel', event.target.value as ExperienceLevel)}
            />
          </div>
          <div className="question-form-row">
            <Input
              label="Years of Experience"
              type="number"
              min={0}
              value={candidateForm.yearsOfExperience || ''}
              onChange={(event) => updateCandidateForm('yearsOfExperience', event.target.value ? Number(event.target.value) : undefined)}
            />
            <Input
              label="Current Company"
              value={candidateForm.currentCompany || ''}
              onChange={(event) => updateCandidateForm('currentCompany', event.target.value)}
            />
          </div>
          <Textarea
            label="Notes"
            value={candidateForm.notes || ''}
            onChange={(event) => updateCandidateForm('notes', event.target.value)}
          />
        </form>
      </Modal>

      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title={selectedCandidate ? `Send Test to ${selectedCandidate.firstName} ${selectedCandidate.lastName}` : 'Send Test'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(false)}>
              Close
            </Button>
            {generatedExam ? (
              <>
                <Link href={`/admin/exams/${generatedExam.id}/preview`}>
                  <Button type="button" variant="secondary">
                    Preview Candidate View
                  </Button>
                </Link>
                <Button type="button" variant="primary" onClick={copyInviteLink}>
                  Copy Link
                </Button>
              </>
            ) : (
              <Button type="button" variant="primary" isLoading={busyId === selectedCandidate?.id} onClick={handleGenerateInvite}>
                Generate Test Link
              </Button>
            )}
          </>
        }
      >
        <div className="question-form">
          <div className="question-form-row">
            <Select
              label="Test Level"
              options={EXPERIENCE_LEVELS}
              value={inviteForm.experienceLevel}
              onChange={(event) => setInviteForm({ ...inviteForm, experienceLevel: event.target.value as ExperienceLevel })}
            />
            <Input
              label="Time Limit"
              type="number"
              min={15}
              value={inviteForm.timeLimitMinutes}
              onChange={(event) => setInviteForm({ ...inviteForm, timeLimitMinutes: Number(event.target.value) })}
              hint="Minutes"
            />
            <Input
              label="Questions"
              type="number"
              min={1}
              value={inviteForm.totalQuestions}
              onChange={(event) => setInviteForm({ ...inviteForm, totalQuestions: Number(event.target.value) })}
            />
          </div>

          {generatedExam && (
            <div className="invite-link-panel">
              <label className="form-label">Candidate Link</label>
              <input className="form-input" readOnly value={buildInviteLink(generatedExam)} />
              <div className="form-hint">
                This link is valid until {generatedExam.tokenExpiresAt ? new Date(generatedExam.tokenExpiresAt).toLocaleString() : 'the token expires'}.
              </div>
              <div className="invite-link-actions">
                <Link href={`/admin/exams/${generatedExam.id}/preview`}>
                  <Button type="button" variant="outline" size="sm">
                    Preview Candidate View
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
