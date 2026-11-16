import { getDb } from "@/db";
import { getExamSessionId } from "@/lib/auth/exam-session";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { examShowsFigure } from "@/lib/services/exams";
import { getFigure } from "@/lib/services/questions";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Question figures. Staff can view any figure; a candidate only those in their own exam.
 * Figures are immutable, so they can be cached privately.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const db = await getDb();

  const user = await getCurrentUser();
  let allowed = !!user && (can(user.role, "viewQuestions") || can(user.role, "viewResults"));
  if (!allowed) {
    const examId = await getExamSessionId();
    allowed = !!examId && (await examShowsFigure(db, examId, id));
  }
  if (!allowed) return notFound();

  const figure = await getFigure(db, id);
  if (!figure) return notFound();
  return new Response(new Uint8Array(figure.data), {
    headers: {
      "Content-Type": figure.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(figure.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      // Neutralises anything active in an SVG opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
