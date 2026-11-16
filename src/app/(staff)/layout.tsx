import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/labels";
import { logout } from "../login/actions";
import { NavLink } from "./nav-link";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/candidates", label: "Candidates", show: can(user.role, "manageCandidates") || can(user.role, "viewResults") },
    { href: "/exams", label: "Exams & results", show: can(user.role, "viewResults") },
    { href: "/questions", label: "Question bank", show: can(user.role, "viewQuestions") },
    { href: "/users", label: "Staff accounts", show: can(user.role, "manageUsers") },
    { href: "/audit", label: "Audit log", show: can(user.role, "viewAudit") },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white print:hidden md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-full flex-col">
          <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4 font-semibold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">IN</span>
            INNOVA Hire
          </Link>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
            {nav.map((n) => (
              <NavLink key={n.href} href={n.href}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="hidden border-t border-slate-200 p-4 text-sm md:block">
            <Link href="/account" className="block font-medium text-slate-800 hover:underline">{user.name}</Link>
            <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
            <form action={logout} className="mt-3">
              <button className="btn-secondary btn-sm w-full">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={logout} className="mt-10 print:hidden md:hidden">
          <button className="btn-secondary btn-sm">Sign out ({user.name})</button>
        </form>
      </main>
    </div>
  );
}
