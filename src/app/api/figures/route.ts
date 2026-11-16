import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { ServiceError } from "@/lib/services/common";
import { addFigure, MAX_FIGURE_BYTES } from "@/lib/services/questions";

/** Uploads a question figure (staff who maintain the question bank). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "manageQuestions")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FIGURE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Figures must be 5 MB or smaller." }, { status: 413 });
  }
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  try {
    const saved = await addFigure(await getDb(), user, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
