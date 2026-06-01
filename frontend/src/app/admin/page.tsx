'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/ui/Card';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import type { AdminDashboardStats } from '@/types';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.getAdminDashboard();
        setStats(response.data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="page-content">
          <div className="loading-overlay">
            <div className="spinner spinner-md" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      </>
    );
  }

  if (!stats) {
    return (
      <>
        <Header title="Dashboard" breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]} />
        <div className="page-content">
          <Card>
            <h3>Dashboard unavailable</h3>
            <p className="admin-muted-cell">The real statistics endpoint could not be loaded.</p>
          </Card>
        </div>
      </>
    );
  }

  const questionActivationRate = stats.totalQuestions > 0
    ? Math.round((stats.activeQuestions / stats.totalQuestions) * 100)
    : 0;
  const recentActivity = stats.recentActivity || [];

  return (
    <>
      <Header title="Dashboard" breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]} />
      <div className="page-content">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Welcome to INNOVA Admin</h1>
            <p>Live overview of your examination platform</p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            icon="?"
            value={stats.totalQuestions}
            label="Total Questions"
            change={{ value: `${stats.activeQuestions} published`, positive: true }}
            iconColor="orange"
            className="stagger-1"
          />
          <StatCard
            icon="ID"
            value={stats.totalCandidates.toLocaleString()}
            label="Total Candidates"
            change={{ value: 'from database', positive: true }}
            iconColor="blue"
            className="stagger-2"
          />
          <StatCard
            icon="EX"
            value={stats.completedExams}
            label="Completed Exams"
            change={{ value: `${stats.totalExams} generated`, positive: true }}
            iconColor="green"
            className="stagger-3"
          />
          <StatCard
            icon="%"
            value={`${stats.averageScore}%`}
            label="Average Score"
            change={{ value: `${stats.passingRate}% pass rate`, positive: stats.passingRate > 60 }}
            iconColor="orange"
            className="stagger-4"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          <Card className="animate-fadeInUp stagger-5">
            <h3 style={{ marginBottom: 'var(--space-5)' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {recentActivity.length > 0 ? recentActivity.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-4)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--color-info)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.action}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>by {item.userName}</div>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              )) : (
                <div className="admin-empty-inline">No recent activity yet.</div>
              )}
            </div>
          </Card>

          <Card className="animate-fadeInUp stagger-6">
            <h3 style={{ marginBottom: 'var(--space-5)' }}>Quick Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Pass Rate</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{stats.passingRate}%</span>
                </div>
                <div className="result-category-bar">
                  <div className="result-category-fill" style={{ width: `${stats.passingRate}%` }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Avg Score</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{stats.averageScore}%</span>
                </div>
                <div className="result-category-bar">
                  <div className="result-category-fill" style={{ width: `${stats.averageScore}%` }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Published Questions</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{questionActivationRate}%</span>
                </div>
                <div className="result-category-bar">
                  <div className="result-category-fill" style={{ width: `${questionActivationRate}%` }} />
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                  PLATFORM STATUS
                </div>
                <Badge variant="success" dot>Live database statistics</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
