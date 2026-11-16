import type { Metadata } from "next";
import { getDb } from "@/db";
import { ROLES } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, formatDate, PageHeader } from "@/components/ui";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { listUsers } from "@/lib/services/users";
import { createUserAction, updateUserAction } from "./actions";

export const metadata: Metadata = { title: "Staff accounts" };

function RoleSelect({ value, id }: { value?: string; id: string }) {
  return (
    <select id={id} name="role" defaultValue={value ?? "hr"} className="input">
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  );
}

export default async function UsersPage() {
  await requireUser(rolesFor("manageUsers"));
  const users = await listUsers(await getDb());
  return (
    <>
      <PageHeader title="Staff accounts" subtitle="Administrators manage everything; engineers maintain questions and grade; HR manages candidates and exams." />
      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span>
                <span className="font-medium">{u.name}</span> <span className="text-sm text-slate-500">{u.email}</span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Badge tone={u.role === "admin" ? "violet" : u.role === "engineer" ? "blue" : "slate"}>{ROLE_LABELS[u.role]}</Badge>
                {!u.active && <Badge tone="red">Deactivated</Badge>}
                <span className="text-xs text-slate-500">Last sign-in {formatDate(u.lastLoginAt)}</span>
              </span>
            </summary>
            <ActionForm action={updateUserAction.bind(null, u.id)} className="grid gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
              <div><label className="label" htmlFor={`n-${u.id}`}>Name</label><input id={`n-${u.id}`} name="name" defaultValue={u.name} className="input" /></div>
              <div><label className="label" htmlFor={`r-${u.id}`}>Role</label><RoleSelect id={`r-${u.id}`} value={u.role} /></div>
              <div><label className="label" htmlFor={`p-${u.id}`}>Reset password</label><input id={`p-${u.id}`} name="password" type="password" autoComplete="new-password" placeholder="Leave blank to keep" className="input" /></div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4" /> Active</label>
              <div className="sm:col-span-2"><SubmitButton className="btn-secondary">Save</SubmitButton></div>
            </ActionForm>
          </details>
        ))}
      </div>

      <section className="card card-body mt-6 max-w-2xl">
        <h2 className="mb-3 font-semibold">Add staff member</h2>
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
          <div><label className="label" htmlFor="role">Role</label><RoleSelect id="role" /></div>
          <div><label className="label" htmlFor="password">Temporary password</label><input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></div>
          <div className="sm:col-span-2"><SubmitButton>Create account</SubmitButton></div>
        </ActionForm>
      </section>
    </>
  );
}
