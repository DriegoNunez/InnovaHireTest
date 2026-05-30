'use client';

import React from 'react';

type BadgeVariant = 'orange' | 'blue' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = 'neutral', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${dot ? 'badge-dot' : ''} ${className}`}>
      {children}
    </span>
  );
}

// Status badge helper
export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    invited: { variant: 'info', label: 'Invited' },
    in_progress: { variant: 'blue', label: 'In Progress' },
    completed: { variant: 'success', label: 'Completed' },
    expired: { variant: 'danger', label: 'Expired' },
    not_started: { variant: 'neutral', label: 'Not Started' },
    submitted: { variant: 'blue', label: 'Submitted' },
    graded: { variant: 'success', label: 'Graded' },
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'neutral', label: 'Inactive' },
  };

  const { variant, label } = config[status] || { variant: 'neutral' as BadgeVariant, label: status };

  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

export default Badge;
