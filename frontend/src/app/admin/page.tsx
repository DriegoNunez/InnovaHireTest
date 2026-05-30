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
        // Use mock data for demo
        setStats({
          totalQuestions: 248,
          activeQuestions: 212,
          totalCandidates: 1456,
          totalExams: 892,
          completedExams: 756,
          averageScore: 73.5,
          passingRate: 68.2,
          recentActivity: [],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading || !stats) {
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

  return (
    <>
      <Header title="Dashboard" breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]} />
      <div className="page-content">
        <div className="page-header">
          <div className="page-header-left">
            <h1>Welcome to INNOVA Admin</h1>
            <p>Overview of your examination platform</p>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            icon="❓"
            value={stats.totalQuestions}
            label="Total Questions"
            change={{ value: `${stats.activeQuestions} active`, positive: true }}
            iconColor="orange"
            className="stagger-1"
          />
          <StatCard
            icon="👤"
            value={stats.totalCandidates.toLocaleString()}
            label="Total Candidates"
            change={{ value: '+12% this month', positive: true }}
            iconColor="blue"
            className="stagger-2"
          />
          <StatCard
            icon="📝"
            value={stats.completedExams}
            label="Completed Exams"
            change={{ value: `${stats.totalExams} total`, positive: true }}
            iconColor="green"
            className="stagger-3"
          />
          <StatCard
            icon="📊"
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
              {[
                { action: 'New exam submitted', user: 'Maria Garcia', time: '2 min ago', type: 'info' },
                { action: 'Question added to bank', user: 'Admin User', time: '15 min ago', type: 'success' },
                { action: 'Candidate invited', user: 'HR Manager', time: '1 hour ago', type: 'warning' },
                { action: 'Results graded by AI', user: 'System', time: '2 hours ago', type: 'success' },
                { action: 'New HR user created', user: 'Admin User', time: '3 hours ago', type: 'info' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid',
                    borderLeftColor: item.type === 'success' ? 'var(--color-success)' : item.type === 'warning' ? 'var(--color-warning)' : 'var(--color-info)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.action}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>by {item.user}</div>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{item.time}</span>
                </div>
              ))}
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
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Active Questions</span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {Math.round((stats.activeQuestions / stats.totalQuestions) * 100)}%
                  </span>
                </div>
                <div className="result-category-bar">
                  <div className="result-category-fill" style={{ width: `${(stats.activeQuestions / stats.totalQuestions) * 100}%` }} />
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                  PLATFORM STATUS
                </div>
                <Badge variant="success" dot>All systems operational</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
