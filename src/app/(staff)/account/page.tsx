import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { changePasswordAction } from "../users/actions";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Your account" subtitle={`${user.email} · ${ROLE_LABELS[user.role]}`} />
      <section className="card card-body max-w-md">
        <h2 className="mb-3 font-semibold">Change password</h2>
        <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-3">
          <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
          <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" minLength={10} autoComplete="new-password" required className="input" /></div>
          <div><label className="label" htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required className="input" /></div>
          <SubmitButton>Update password</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
