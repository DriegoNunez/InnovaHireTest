'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login({ email, password });
      // AuthContext sets the user; we redirect based on role
      const userJson = localStorage.getItem('innova_user');
      if (userJson) {
        const user = JSON.parse(userJson);
        if (user.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/hr');
        }
      }
    } catch {
      // error is handled by AuthContext
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-card animate-fadeInUp">
          <div className="login-logo">
            <img
              src="https://innovanv.com/wp-content/uploads/2025/02/innova_large.png"
              alt="INNOVA Technologies"
            />
          </div>

          <div className="login-heading">
            <h1>Welcome Back</h1>
            <p>Sign in to the INNOVA Exam Platform</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@innovanv.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="lg" isLoading={isLoading}>
              Sign In
            </Button>
          </form>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-content animate-fadeIn">
          <h2>Empower Your Hiring Process</h2>
          <p>
            Streamline candidate evaluation with AI-powered assessments,
            real-time behavior monitoring, and intelligent grading — all
            from one powerful platform.
          </p>
        </div>
      </div>
    </div>
  );
}
