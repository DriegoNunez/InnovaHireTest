import Link from "next/link";
import type { ExamStatus, QuestionStatus } from "@/db/schema";
import { EXAM_STATUS_LABELS, QUESTION_STATUS_LABELS } from "@/lib/labels";

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const EXAM_TONES: Record<ExamStatus, string> = {
  ready: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  submitted: "bg-sky-100 text-sky-800",
  graded: "bg-violet-100 text-violet-800",
  finalized: "bg-emerald-100 text-emerald-800",
  revoked: "bg-red-100 text-red-700",
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  return <span className={`badge ${EXAM_TONES[status]}`}>{EXAM_STATUS_LABELS[status]}</span>;
}

const Q_TONES: Record<QuestionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-zinc-200 text-zinc-600",
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return <span className={`badge ${Q_TONES[status]}`}>{QUESTION_STATUS_LABELS[status]}</span>;
}

export function Badge({ tone = "slate", children }: { tone?: "slate" | "green" | "amber" | "red" | "blue" | "violet"; children: React.ReactNode }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="card card-body h-full transition hover:border-slate-300">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: React.ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function formatDate(value: Date | string | null | undefined, withTime = true) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function pct(earned: number | null | undefined, total: number) {
  if (earned == null || !total) return "—";
  return `${Math.round((Number(earned) / total) * 100)}%`;
}
