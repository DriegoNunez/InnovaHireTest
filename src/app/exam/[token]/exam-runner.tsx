"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IntegrityEventType } from "@/db/schema";
import type { getCandidateView } from "@/lib/services/exams";

type View = NonNullable<Awaited<ReturnType<typeof getCandidateView>>>;
type Question = View["questions"][number];
type Attachment = { id: string; fileName: string; contentType: string } | null;
type Answer = { selectedOptionIds: string[]; text: string; flagged: boolean; attachment: Attachment };
type SaveState = "saved" | "saving" | "pending" | "error";
type Phase = "taking" | "submitting" | "done" | "ended";

const TYPE_HINT: Record<string, string> = {
  single_choice: "Choose one answer.",
  true_false: "Choose true or false.",
  multiple_choice: "Select all that apply. Wrong selections reduce your score.",
  short_answer: "Answer in a few sentences or give your numeric result with units.",
  long_answer: "Show your method, assumptions and units. Partial credit is given.",
};

const emptyAnswer = (): Answer => ({ selectedOptionIds: [], text: "", flagged: false, attachment: null });

const isAnswered = (q: Question, a?: Answer) =>
  !!a && (q.options.length ? a.selectedOptionIds.length > 0 : a.text.trim().length > 0 || !!a.attachment);

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

export function ExamRunner({ initial, serverNow }: { initial: View; serverNow: string }) {
  const questions = initial.questions;
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(initial.answers.map((a) => [a.examQuestionId, { selectedOptionIds: a.selectedOptionIds, text: a.text, flagged: a.flagged, attachment: a.attachment }])),
  );
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("taking");
  const [endMessage, setEndMessage] = useState("");
  const [deadline, setDeadline] = useState(() => new Date(initial.exam.deadlineAt!).getTime());
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const dirty = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const events = useRef<{ type: IntegrityEventType; detail?: string; at: string }[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const remaining = (deadline - (now + offset)) / 1000;
  const question = questions[index];
  const answer = answers[question.id] ?? emptyAnswer();
  const answeredCount = useMemo(() => questions.filter((q) => isAnswered(q, answers[q.id])).length, [questions, answers]);
  const flaggedCount = useMemo(() => questions.filter((q) => answers[q.id]?.flagged).length, [questions, answers]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? "" : t)), 3500);
  }, []);

  const endExam = useCallback((message: string) => {
    setEndMessage(message);
    setPhase((p) => (p === "done" ? p : "ended"));
  }, []);

  // ------------------------------------------------------------------ saving
  const persist = useCallback(
    async (questionId: string) => {
      const a = answersRef.current[questionId] ?? emptyAnswer();
      dirty.current.delete(questionId);
      setSaveState((s) => ({ ...s, [questionId]: "saving" }));
      try {
        const res = await fetch("/api/exam/answers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examQuestionId: questionId,
            selectedOptionIds: a.selectedOptionIds,
            text: a.text,
            attachmentId: a.attachment?.id ?? null,
            flagged: a.flagged,
          }),
        });
        if (res.status === 409 || res.status === 401) {
          const body = await res.json().catch(() => ({}));
          endExam(body.error ?? "This exam has ended.");
          return false;
        }
        if (!res.ok) throw new Error(String(res.status));
        setSaveState((s) => ({ ...s, [questionId]: dirty.current.has(questionId) ? "pending" : "saved" }));
        return true;
      } catch {
        dirty.current.add(questionId);
        setSaveState((s) => ({ ...s, [questionId]: "error" }));
        return false;
      }
    },
    [endExam],
  );

  const schedule = useCallback(
    (questionId: string, delay: number) => {
      dirty.current.add(questionId);
      setSaveState((s) => ({ ...s, [questionId]: "pending" }));
      clearTimeout(timers.current.get(questionId));
      timers.current.set(questionId, setTimeout(() => void persist(questionId), delay));
    },
    [persist],
  );

  const flushAll = useCallback(async () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    const ids = [...dirty.current];
    const results = await Promise.all(ids.map((id) => persist(id)));
    return results.every(Boolean);
  }, [persist]);

  // The ref is updated synchronously so a save that fires before React re-renders
  // (e.g. right after an upload resolves) still sends the latest answer.
  const updateQuestion = (questionId: string, patch: Partial<Answer>, delay = 0) => {
    const prev = answersRef.current;
    const next = { ...prev, [questionId]: { ...(prev[questionId] ?? emptyAnswer()), ...patch } };
    answersRef.current = next;
    setAnswers(next);
    schedule(questionId, delay);
  };
  const update = (patch: Partial<Answer>, delay = 0) => updateQuestion(question.id, patch, delay);

  // Retry failed saves every few seconds.
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "taking") return;
      for (const qid of dirty.current) if (!timers.current.has(qid) || saveState[qid] === "error") void persist(qid);
    }, 5000);
    return () => clearInterval(id);
  }, [persist, saveState]);

  // ------------------------------------------------------------- integrity
  const flushEvents = useCallback(() => {
    if (!events.current.length) return;
    const batch = events.current.splice(0, 100);
    void fetch("/api/exam/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    }).catch(() => events.current.unshift(...batch));
  }, []);

  useEffect(() => {
    if (phase !== "taking") return;
    const record = (type: IntegrityEventType, detail?: string) => events.current.push({ type, detail, at: new Date().toISOString() });
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        record("tab_hidden");
        flushEvents();
      } else if (hiddenAt) {
        const secs = Math.round((Date.now() - hiddenAt) / 1000);
        if (secs >= 2) showToast(`You were away from the exam for ${secs}s. This is recorded.`);
        hiddenAt = 0;
      }
    };
    const onBlur = () => setTimeout(() => !document.hidden && record("window_blur"), 150);
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      record("copy");
      showToast("Copying is disabled during the exam.");
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      record("paste", `${e.clipboardData?.getData("text")?.length ?? 0} characters`);
      showToast("Pasting is disabled during the exam. Type your answer instead.");
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      record("context_menu");
    };
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(key)) || (e.metaKey && e.altKey && key === "i")) {
        e.preventDefault();
        record("devtools_shortcut");
      }
      if (e.key === "PrintScreen") record("print_screen");
    };
    const onFullscreen = () => !document.fullscreenElement && record("fullscreen_exit");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    const flusher = setInterval(flushEvents, 5000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      clearInterval(flusher);
      flushEvents();
    };
  }, [phase, flushEvents, showToast]);

  // Warn before closing with unsaved work.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === "taking" && dirty.current.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // ---------------------------------------------------------------- submit
  const submit = useCallback(
    async (auto: boolean) => {
      if (phaseRef.current !== "taking") return;
      setPhase("submitting");
      setConfirming(false);
      await flushAll();
      flushEvents();
      try {
        const res = await fetch("/api/exam/submit", { method: "POST" });
        if (res.ok || res.status === 409) {
          setEndMessage(auto ? "Time is up. Your saved answers were submitted automatically." : "Your exam has been submitted.");
          setPhase("done");
          return;
        }
        throw new Error(String(res.status));
      } catch {
        if (auto) {
          // The server submits on its own once the deadline passes; nothing is lost.
          setEndMessage("Time is up. Your saved answers have been submitted.");
          setPhase("done");
        } else {
          setPhase("taking");
          showToast("Could not reach the server. Check your connection and try again.");
        }
      }
    },
    [flushAll, flushEvents, showToast],
  );

  // ----------------------------------------------------------------- clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "taking") return;
    if (remaining <= 0) void submit(true);
    const mins = Math.ceil(remaining / 60);
    if ([10, 5, 1].includes(mins) && Math.ceil((remaining + 1) / 60) !== mins) {
      setAnnouncement(`${mins} minute${mins > 1 ? "s" : ""} remaining`);
      showToast(`${mins} minute${mins > 1 ? "s" : ""} left`);
    }
  }, [remaining, phase, submit, showToast]);

  // Heartbeat: re-sync deadline and notice if the exam was ended elsewhere.
  useEffect(() => {
    if (phase !== "taking") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/exam/state", { cache: "no-store" });
        if (res.status === 401) return endExam("Your exam session has ended.");
        const body = await res.json();
        if (body.status && body.status !== "in_progress") {
          endExam(body.status === "revoked" ? "This exam was cancelled by the hiring team." : "This exam has ended and your saved answers were submitted.");
        } else if (body.deadlineAt) {
          setDeadline(new Date(body.deadlineAt).getTime());
        }
      } catch {
        /* offline; the next tick will retry */
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [phase, endExam]);

  // ---------------------------------------------------------------- upload
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const questionId = question.id;
    setUploadError("");
    if (file.size > 10 * 1024 * 1024) return setUploadError("Files must be 10 MB or smaller.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/exam/attachments", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) return endExam(body.error ?? "This exam has ended.");
      if (!res.ok) return setUploadError(body.error ?? "Upload failed. Try again.");
      updateQuestion(questionId, { attachment: body });
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  // ------------------------------------------------------------------ views
  if (phase === "done" || phase === "ended") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card card-body max-w-lg text-center">
          <h1 className="text-xl font-semibold">{phase === "done" ? "Thank you!" : "The exam has ended"}</h1>
          <p className="mt-2 text-slate-600">{endMessage}</p>
          <p className="mt-2 text-slate-600">The hiring team will review your answers and contact you about next steps. You can close this window.</p>
        </div>
      </main>
    );
  }

  const lowTime = remaining < 300;
  const currentSave = saveState[question.id];
  const anyError = Object.values(saveState).includes("error");

  return (
    <div className="min-h-screen select-none">
      <div className="sr-only" aria-live="polite">{announcement}</div>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{initial.exam.title}</div>
            <div className="text-xs text-slate-500">{answeredCount} of {questions.length} answered{flaggedCount ? ` · ${flaggedCount} flagged` : ""}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${anyError ? "text-red-700" : "text-slate-500"}`} aria-live="polite">
              {anyError ? "Connection problem — retrying…" : Object.values(saveState).some((s) => s === "saving" || s === "pending") ? "Saving…" : "All answers saved"}
            </span>
            <div
              className={`rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${lowTime ? "bg-red-100 text-red-700" : "bg-slate-100 text-ink"}`}
              role="timer"
              aria-label="Time remaining"
            >
              {formatClock(remaining)}
            </div>
            <button className="btn-primary" onClick={() => setConfirming(true)} disabled={phase !== "taking"}>
              {phase === "submitting" ? "Submitting…" : "Finish exam"}
            </button>
          </div>
        </div>
        <div className="h-1 bg-slate-100"><div className="h-1 bg-brand-500 transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Questions" className="lg:sticky lg:top-24 lg:self-start">
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
            {questions.map((q, i) => {
              const a = answers[q.id];
              const done = isAnswered(q, a);
              return (
                <button
                  key={q.id}
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${q.position}${done ? ", answered" : ""}${a?.flagged ? ", flagged" : ""}`}
                  className={`relative h-9 rounded-md border text-sm font-medium tabular-nums transition ${
                    i === index ? "border-brand-600 ring-2 ring-brand-100" : "border-slate-200"
                  } ${done ? "bg-brand-50 text-brand-700" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {q.position}
                  {a?.flagged && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 hidden text-xs text-slate-500 lg:block">Blue = answered · amber dot = flagged</p>
        </nav>

        <section className="card" aria-labelledby="q-title">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm">
            <h2 id="q-title" className="font-semibold text-ink">Question {question.position} of {questions.length}</h2>
            <span className="text-slate-500">{question.category} · {question.points} pts</span>
          </div>
          <div className="space-y-5 px-5 py-5">
            <p className="prose-q text-base text-slate-900">{question.prompt}</p>
            <p className="text-sm text-slate-500">{TYPE_HINT[question.type]}</p>

            {question.options.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="sr-only">Answer options</legend>
                {question.options.map((o) => {
                  const multi = question.type === "multiple_choice";
                  const checked = answer.selectedOptionIds.includes(o.id);
                  return (
                    <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${checked ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={`q-${question.id}`}
                        className="mt-0.5 h-4 w-4"
                        checked={checked}
                        onChange={() =>
                          update({
                            selectedOptionIds: multi
                              ? checked
                                ? answer.selectedOptionIds.filter((id) => id !== o.id)
                                : [...answer.selectedOptionIds, o.id]
                              : [o.id],
                          })
                        }
                      />
                      <span className="text-slate-800">{o.text}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <div className="space-y-3">
                <label htmlFor={`a-${question.id}`} className="label">Your answer</label>
                <textarea
                  id={`a-${question.id}`}
                  rows={question.type === "long_answer" ? 14 : 6}
                  className="input select-text font-mono text-sm"
                  value={answer.text}
                  maxLength={20000}
                  onChange={(e) => update({ text: e.target.value }, 900)}
                  onBlur={() => dirty.current.has(question.id) && void persist(question.id)}
                  placeholder="Type your answer. Include units and state any assumptions."
                  spellCheck={false}
                />
                {question.allowAttachment && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4">
                    <div className="text-sm font-medium text-slate-700">Hand calculations or sketch (optional)</div>
                    <p className="text-xs text-slate-500">Upload one photo or PDF (max 10 MB). A new upload replaces the previous one.</p>
                    {answer.attachment && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="badge bg-emerald-100 text-emerald-800">Attached</span>
                        <span className="truncate">{answer.attachment.fileName}</span>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => update({ attachment: null })}>Remove</button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                      className="mt-2 block text-sm"
                      disabled={uploading}
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
                    {uploadError && <p role="alert" className="mt-1 text-xs text-red-700">{uploadError}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" className="h-4 w-4" checked={answer.flagged} onChange={(e) => update({ flagged: e.target.checked })} />
                Flag to revisit
              </label>
              <span className="text-xs text-slate-400">
                {currentSave === "saving" || currentSave === "pending" ? "Saving…" : currentSave === "error" ? "Not saved yet — retrying" : currentSave === "saved" ? "Saved" : ""}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
                {index < questions.length - 1 ? (
                  <button className="btn-primary" onClick={() => setIndex(index + 1)}>Next</button>
                ) : (
                  <button className="btn-primary" onClick={() => setConfirming(true)}>Review &amp; finish</button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="card card-body w-full max-w-md">
            <h2 id="confirm-title" className="text-lg font-semibold">Finish the exam?</h2>
            <p className="mt-2 text-sm text-slate-600">
              You answered {answeredCount} of {questions.length} questions
              {flaggedCount ? ` and flagged ${flaggedCount} to revisit` : ""}. After finishing you cannot change your answers.
            </p>
            {answeredCount < questions.length && (
              <p className="mt-2 text-sm text-amber-700">{questions.length - answeredCount} question(s) are unanswered.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirming(false)} autoFocus>Keep working</button>
              <button className="btn-primary" onClick={() => void submit(false)}>Finish exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
