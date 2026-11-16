import type { Metadata } from "next";
import { getDb } from "@/db";
import { getExamSessionId } from "@/lib/auth/exam-session";
import { getCandidateView, resolveToken } from "@/lib/services/exams";
import { Logo } from "@/components/logo";
import { ExamRunner } from "./exam-runner";
import { StartButton } from "./start-button";

export const metadata: Metadata = { title: "Technical assessment", referrer: "no-referrer" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center"><Logo /></div>
        <div className="card card-body">{children}</div>
      </div>
    </main>
  );
}

export default async function CandidateExamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const resolved = await resolveToken(db, token);

  if (resolved.state === "invalid")
    return <Shell><h1 className="text-xl font-semibold">This link is not valid</h1><p className="mt-2 text-slate-600">Check that you copied the full link from your invitation email. If you received a newer invitation, use that link instead.</p></Shell>;
  if (resolved.state === "expired")
    return <Shell><h1 className="text-xl font-semibold">This link has expired</h1><p className="mt-2 text-slate-600">Please contact your recruiter to receive a new invitation.</p></Shell>;
  if (resolved.state === "revoked")
    return <Shell><h1 className="text-xl font-semibold">This exam is no longer available</h1><p className="mt-2 text-slate-600">Please contact your recruiter if you think this is a mistake.</p></Shell>;
  if (resolved.state === "finished")
    return <Shell><h1 className="text-xl font-semibold">Your exam has been submitted</h1><p className="mt-2 text-slate-600">Thank you. The hiring team will review your answers and be in touch about next steps.</p></Shell>;

  const { exam } = resolved;
  const sessionExamId = await getExamSessionId();

  if (resolved.state === "in_progress" && sessionExamId === exam.id) {
    const view = (await getCandidateView(db, exam.id))!;
    return <ExamRunner initial={view} serverNow={new Date().toISOString()} />;
  }

  const view = (await getCandidateView(db, exam.id))!;
  const resume = resolved.state === "in_progress";
  return (
    <Shell>
      <h1 className="text-xl font-semibold">{resume ? "Continue your exam" : `Welcome, ${view.exam.candidateName.split(" ")[0]}`}</h1>
      <p className="mt-1 text-slate-600">{exam.title}</p>
      {resume ? (
        <p className="mt-4 text-sm text-slate-700">Your exam is already running and the timer has not stopped. Continue on this device to pick up where you left off.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>• <strong>{view.questions.length} questions</strong>, {exam.totalPoints} points in total.</li>
            <li>• <strong>{exam.timeLimitMinutes} minutes.</strong> The timer starts when you press Start and does not pause. When time runs out your saved answers are submitted automatically.</li>
            <li>• Answers save automatically as you go. You can move between questions and flag ones to revisit.</li>
            <li>• Have a calculator and paper ready. Some problems let you upload a photo or PDF of your hand calculations.</li>
            <li>• Stay in this tab. Switching tabs or windows, copying and pasting are recorded for the reviewers.</li>
            <li>• Use your own knowledge and reasoning. Show your work on written problems; partial credit is given.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">By starting you confirm you are {view.exam.candidateName} and will complete the exam without help from others.</p>
        </>
      )}
      <div className="mt-6"><StartButton token={token} label={resume ? "Continue exam" : "Start exam"} /></div>
    </Shell>
  );
}
