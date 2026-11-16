import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe. Only the hash is stored. */
export const generateAccessToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
