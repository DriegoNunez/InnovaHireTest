'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  basePath: string;
  navSections: { title: string; items: NavItem[] }[];
  roleLabel: string;
}

export function Sidebar({ basePath, navSections, roleLabel }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === basePath) return pathname === basePath;
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img
          src="https://innovanv.com/wp-content/uploads/2025/02/innova_large.png"
          alt="INNOVA"
        />
        <span className="sidebar-logo-text">{roleLabel}</span>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <div className="sidebar-section-title">{section.title}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive(item.href) ? 'sidebar-link-active' : ''}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role">{user?.role || roleLabel}</div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={logout}
            title="Sign Out"
            style={{ fontSize: '1.1rem', marginLeft: 'auto' }}
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
