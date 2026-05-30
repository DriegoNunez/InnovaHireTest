'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'admin' | 'hr';
}

const blankUser: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'hr',
};

export default function AdminUsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(blankUser);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch {
      setUsers([
        {
          id: 'demo-admin',
          email: 'admin@innovanv.com',
          name: 'System Administrator',
          role: 'admin',
          isActive: true,
          createdAt: '2026-05-20T10:00:00Z',
          updatedAt: '2026-05-20T10:00:00Z',
        },
        {
          id: 'demo-hr',
          email: 'hr@innovanv.com',
          name: 'HR Manager',
          role: 'hr',
          isActive: true,
          createdAt: '2026-05-18T10:00:00Z',
          updatedAt: '2026-05-18T10:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        roles: [form.role === 'admin' ? 'Admin' : 'HR'],
      });
      addToast({ type: 'success', title: 'User account created' });
      setForm(blankUser);
      setIsModalOpen(false);
      await fetchUsers();
    } catch {
      addToast({ type: 'error', title: 'Failed to create user account' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (user: User) => {
    try {
      await api.deleteUser(user.id);
      addToast({ type: 'success', title: 'User deactivated' });
      await fetchUsers();
    } catch {
      addToast({ type: 'error', title: 'Failed to deactivate user' });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (user: User) => (
        <div className="admin-table-question">
          <strong>{user.name}</strong>
          <span className="admin-muted-cell">{user.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user: User) => <Badge variant={user.role === 'admin' ? 'orange' : 'blue'}>{user.role.toUpperCase()}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (user: User) => <span className="admin-muted-cell">{new Date(user.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (user: User) => <StatusBadge status={user.isActive === false ? 'inactive' : 'active'} />,
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      render: (user: User) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={user.isActive === false}
          onClick={() => handleDeactivate(user)}
        >
          Deactivate
        </Button>
      ),
    },
  ];

  return (
    <>
      <Header
        title="User Management"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        actions={<Button variant="primary" onClick={() => setIsModalOpen(true)}>New User</Button>}
      />
      <div className="page-content">
        <div className="admin-summary-strip">
          <div>
            <span>{users.length}</span>
            <label>Total Users</label>
          </div>
          <div>
            <span>{users.filter((user) => user.role === 'hr').length}</span>
            <label>HR Staff</label>
          </div>
          <div>
            <span>{users.filter((user) => user.role === 'admin').length}</span>
            <label>Admins</label>
          </div>
          <div>
            <span>{users.filter((user) => user.isActive !== false).length}</span>
            <label>Active</label>
          </div>
        </div>

        <Table
          columns={columns}
          data={users}
          keyExtractor={(user) => user.id}
          isLoading={loading}
          totalItems={users.length}
          emptyMessage="No user accounts found."
          emptyIcon="U"
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create User Account"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="admin-user-form" isLoading={saving}>
              Create User
            </Button>
          </>
        }
      >
        <form id="admin-user-form" className="question-form" onSubmit={handleSubmit}>
          <div className="question-form-row">
            <Input
              label="First Name"
              required
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
            <Input
              label="Last Name"
              required
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <div className="question-form-row">
            <Input
              label="Temporary Password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <Select
              label="Role"
              required
              options={[
                { value: 'hr', label: 'HR' },
                { value: 'admin', label: 'Admin' },
              ]}
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as UserFormState['role'] })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
