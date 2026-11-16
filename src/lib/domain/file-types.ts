/** Light content sniffing so a renamed executable is not stored as a "PDF" or an image. */
export function looksLike(contentType: string, bytes: Buffer) {
  const head = bytes.subarray(0, 12);
  switch (contentType) {
    case "application/pdf":
      return head.subarray(0, 5).toString("latin1") === "%PDF-";
    case "image/png":
      return head[0] === 0x89 && head.subarray(1, 4).toString("latin1") === "PNG";
    case "image/jpeg":
      return head[0] === 0xff && head[1] === 0xd8;
    case "image/gif":
      return head.subarray(0, 4).toString("latin1") === "GIF8";
    case "image/webp":
      return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
    case "image/svg+xml":
      return isSafeSvg(bytes);
    default:
      return false;
  }
}

/**
 * Accepts plain drawing SVGs only. Figures are displayed through <img> (where scripts never
 * run) and served with a sandboxing CSP, but rejecting active content keeps the stored
 * file harmless even if it is opened some other way.
 */
function isSafeSvg(bytes: Buffer) {
  const text = bytes.toString("utf8");
  const start = text.replace(/^﻿/, "").trimStart();
  if (!/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(start)) return false;
  return !/<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object/i.test(text);
}
