'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { api } from '@/lib/api';
import type { AuditFilters, AuditLog } from '@/types';

const demoLogs: AuditLog[] = [
  {
    id: 'audit-1',
    action: 'create_question',
    userId: 'admin',
    userName: 'admin@innovanv.com',
    userRole: 'admin',
    targetType: 'Question',
    targetId: 'demo-1',
    details: 'Published ASCE 7 loading question',
    ipAddress: '127.0.0.1',
    userAgent: '',
    timestamp: '2026-05-30T17:45:00Z',
  },
  {
    id: 'audit-2',
    action: 'create_user',
    userId: 'admin',
    userName: 'admin@innovanv.com',
    userRole: 'admin',
    targetType: 'User',
    targetId: 'demo-hr',
    details: 'Created HR staff account',
    ipAddress: '127.0.0.1',
    userAgent: '',
    timestamp: '2026-05-30T17:20:00Z',
  },
];

const actionOptions = [
  { value: 'create_question', label: 'Create Question' },
  { value: 'update_question', label: 'Update Question' },
  { value: 'delete_question', label: 'Delete Question' },
  { value: 'create_user', label: 'Create User' },
  { value: 'update_user', label: 'Update User' },
  { value: 'delete_user', label: 'Delete User' },
  { value: 'login', label: 'Login' },
];

const formatAction = (action: string) =>
  action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({ page: 1, limit: 20 });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await api.getAuditLogs(filters);
        setLogs(response.data);
        setTotalPages(response.totalPages);
        setTotal(response.total);
      } catch {
        setLogs(demoLogs);
        setTotal(demoLogs.length);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filters]);

  const columns = [
    {
      key: 'timestamp',
      header: 'Time',
      sortable: true,
      render: (log: AuditLog) => (
        <span className="admin-muted-cell">
          {new Date(log.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (log: AuditLog) => <Badge variant="blue">{formatAction(log.action)}</Badge>,
    },
    {
      key: 'userName',
      header: 'Actor',
      sortable: true,
      render: (log: AuditLog) => (
        <div className="admin-table-question">
          <strong>{log.userName}</strong>
          <span className="admin-muted-cell">{log.ipAddress || 'No IP captured'}</span>
        </div>
      ),
    },
    {
      key: 'targetType',
      header: 'Target',
      sortable: true,
      render: (log: AuditLog) => (
        <div className="admin-table-question">
          <strong>{log.targetType}</strong>
          <span className="admin-muted-cell">{log.targetId || 'No target id'}</span>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (log: AuditLog) => <span className="admin-muted-cell">{log.details || 'No details recorded'}</span>,
    },
  ];

  return (
    <>
      <Header
        title="Audit Logs"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Audit Logs' }]}
      />
      <div className="page-content">
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Input
              className="search-input"
              placeholder="Search actions..."
              value={filters.search || ''}
              onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })}
            />
          </div>
          <Select
            options={actionOptions}
            placeholder="All Actions"
            value={filters.action || ''}
            onChange={(event) => setFilters({ ...filters, action: event.target.value as AuditFilters['action'], page: 1 })}
          />
          <Input
            type="date"
            value={filters.startDate || ''}
            onChange={(event) => setFilters({ ...filters, startDate: event.target.value, page: 1 })}
          />
          <Input
            type="date"
            value={filters.endDate || ''}
            onChange={(event) => setFilters({ ...filters, endDate: event.target.value, page: 1 })}
          />
        </div>

        <Table
          columns={columns}
          data={logs}
          keyExtractor={(log) => log.id}
          isLoading={loading}
          emptyMessage="No audit events found."
          emptyIcon="A"
          currentPage={filters.page || 1}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      </div>
    </>
  );
}
