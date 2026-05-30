'use client';

import React from 'react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function Header({ title, breadcrumbs, actions }: HeaderProps) {
  return (
    <header className="main-header">
      <div className="main-header-left">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="page-breadcrumb">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="page-breadcrumb-separator">/</span>}
                  {item.href ? (
                    <Link href={item.href}>{item.label}</Link>
                  ) : (
                    <span style={{ color: 'var(--color-text-primary)' }}>{item.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="page-title">{title}</h1>
        </div>
      </div>
      {actions && <div className="main-header-right">{actions}</div>}
    </header>
  );
}

export default Header;
