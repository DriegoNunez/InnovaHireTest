import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { rolesFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { createCandidateAction } from "../actions";
import { CandidateFields } from "../candidate-fields";

export const metadata: Metadata = { title: "Add candidate" };

export default async function NewCandidatePage() {
  await requireUser(rolesFor("manageCandidates"));
  return (
    <>
      <PageHeader title="Add candidate" back={{ href: "/candidates", label: "Candidates" }} />
      <div className="card card-body max-w-3xl">
        <ActionForm action={createCandidateAction} className="space-y-5">
          <CandidateFields />
          <SubmitButton>Create candidate</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
