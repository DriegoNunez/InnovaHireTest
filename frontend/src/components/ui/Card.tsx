'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', glass = false, hover = false, padding = 'md' }: CardProps) {
  const padClass = padding === 'none' ? '' : padding === 'sm' ? 'card' : padding === 'lg' ? 'card' : 'card';
  const styleOverride: React.CSSProperties = padding === 'none' ? { padding: 0 } : padding === 'sm' ? { padding: 'var(--space-4)' } : padding === 'lg' ? { padding: 'var(--space-8)' } : {};

  return (
    <div
      className={`${padClass} ${glass ? 'card-glass' : ''} ${hover ? 'card-hover' : ''} ${className}`}
      style={styleOverride}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  change?: { value: string; positive: boolean };
  iconColor?: 'orange' | 'blue' | 'green' | 'danger';
  className?: string;
}

export function StatCard({ icon, value, label, change, iconColor = 'orange', className = '' }: StatCardProps) {
  return (
    <div className={`card-stat animate-fadeInUp ${className}`}>
      <div className={`card-stat-icon card-stat-icon-${iconColor}`}>{icon}</div>
      <div className="card-stat-value">{value}</div>
      <div className="card-stat-label">{label}</div>
      {change && (
        <div className={`card-stat-change ${change.positive ? 'card-stat-change-positive' : 'card-stat-change-negative'}`}>
          {change.positive ? '↑' : '↓'} {change.value}
        </div>
      )}
    </div>
  );
}

export default Card;
