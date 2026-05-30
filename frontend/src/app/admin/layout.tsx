'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { LoadingOverlay } from '@/components/ui/Spinner';

const ADMIN_NAV = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/questions', label: 'Question Bank', icon: '❓' },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/users', label: 'User Management', icon: '👥' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { href: '/admin/results', label: 'Exam Results', icon: '📈' },
      { href: '/admin/audit', label: 'Audit Logs', icon: '🔍' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user?.role !== 'admin') {
        router.replace('/hr');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return <LoadingOverlay fullPage message="Loading admin panel..." />;
  }

  return (
    <div className="layout-wrapper">
      <Sidebar basePath="/admin" navSections={ADMIN_NAV} roleLabel="Admin" />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
