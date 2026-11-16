import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo />
          <h1 className="mt-4 text-xl font-semibold">Sign in to INNOVA Hire</h1>
          <p className="mt-1 text-sm text-slate-500">For hiring staff. Candidates use the link in their invitation email.</p>
        </div>
        <div className="card card-body">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
