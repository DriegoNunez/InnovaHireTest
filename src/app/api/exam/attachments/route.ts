import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { addAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/services/exams";
import { withExam } from "../_shared";

export async function POST(request: Request) {
  return withExam(async (examId) => {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_ATTACHMENT_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const saved = await addAttachment(await getDb(), examId, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
    return NextResponse.json(saved);
  });
}
