'use client';

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'orange' | 'blue' | 'white';
  className?: string;
}

export function Spinner({ size = 'md', color = 'orange', className = '' }: SpinnerProps) {
  const colorClass = color !== 'orange' ? `spinner-${color}` : '';
  return <div className={`spinner spinner-${size} ${colorClass} ${className}`} />;
}

interface LoadingOverlayProps {
  message?: string;
  fullPage?: boolean;
}

export function LoadingOverlay({ message = 'Loading...', fullPage = false }: LoadingOverlayProps) {
  return (
    <div className={`loading-overlay ${fullPage ? 'loading-overlay-fullpage' : ''}`}>
      <Spinner size="lg" />
      <span>{message}</span>
    </div>
  );
}

export default Spinner;
