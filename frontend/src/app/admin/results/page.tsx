'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import { api } from '@/lib/api';
import type { ExamAttempt, ResultFilters } from '@/types';

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};

const formatScore = (value?: number) => {
  if (value === undefined || value === null) return 'Pending';
  return `${Number(value).toFixed(1)}%`;
};

export default function AdminResultsPage() {
  const [results, setResults] = useState<ExamAttempt[]>([]);
  const [filters, setFilters] = useState<ResultFilters>({ page: 1, limit: 10, completedOnly: true });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await api.getResults(filters);
        setResults(response.data);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [filters]);

  const stats = useMemo(() => {
    const scored = results.filter((result) => result.percentageScore !== undefined);
    const average = scored.length
      ? scored.reduce((sum, result) => sum + Number(result.percentageScore || 0), 0) / scored.length
      : 0;

    return {
      completed: total,
      graded: scored.length,
      average: average.toFixed(1),
    };
  }, [results, total]);

  const columns = [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (result: ExamAttempt) => (
        <div className="admin-table-question">
          <strong>{result.candidateName || 'Candidate'}</strong>
          <span className="admin-muted-cell">{result.candidateEmail || '-'}</span>
        </div>
      ),
    },
    {
      key: 'examTitle',
      header: 'Exam',
      render: (result: ExamAttempt) => <span>{result.examTitle || '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (result: ExamAttempt) => <StatusBadge status={result.status} />,
      width: '140px',
    },
    {
      key: 'score',
      header: 'Score',
      render: (result: ExamAttempt) => (
        <Badge variant={result.isPassing ? 'success' : result.percentageScore === undefined ? 'neutral' : 'warning'}>
          {formatScore(result.percentageScore)}
        </Badge>
      ),
      width: '120px',
    },
    {
      key: 'submittedAt',
      header: 'Submitted (Las Vegas)',
      render: (result: ExamAttempt) => <span className="admin-muted-cell">{formatDate(result.submittedAt || result.completedAt)}</span>,
      width: '220px',
    },
    {
      key: 'actions',
      header: '',
      render: (result: ExamAttempt) => (
        <Link href={`/admin/results/${result.id}`}>
          <button type="button" className="btn btn-secondary btn-sm">View Solved Exam</button>
        </Link>
      ),
      width: '170px',
    },
  ];

  return (
    <>
      <Header
        title="Completed Exams"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Completed Exams' }]}
      />

      <div className="page-content">
        <div className="admin-summary-strip">
          <div>
            <span>{stats.completed}</span>
            <label>Completed Exams</label>
          </div>
          <div>
            <span>{stats.graded}</span>
            <label>Scored Exams</label>
          </div>
          <div>
            <span>{stats.average}%</span>
            <label>Average Score</label>
          </div>
        </div>

        <Card>
          <div className="filter-bar">
            <div className="search-input-wrapper">
              <Input
                className="search-input"
                placeholder="Search candidate or exam..."
                value={filters.search || ''}
                onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
              />
            </div>
          </div>

          <Table
            columns={columns}
            data={results}
            keyExtractor={(result) => result.id}
            isLoading={loading}
            emptyMessage="No completed exams yet."
            emptyIcon="EX"
            currentPage={filters.page || 1}
            totalPages={totalPages}
            totalItems={total}
            onPageChange={(page) => setFilters({ ...filters, page })}
          />
        </Card>
      </div>
    </>
  );
}
