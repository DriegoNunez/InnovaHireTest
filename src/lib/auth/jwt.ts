import { SignJWT, jwtVerify, type JWTPayload } from "jose";

let warned = false;

function secretKey() {
  let secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to at least 32 characters in production.");
    }
    if (!warned) {
      console.warn("[auth] AUTH_SECRET is not set; using an insecure development secret.");
      warned = true;
    }
    secret = "development-only-secret-do-not-use-in-production!!";
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JWTPayload, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
}

export async function verifyToken<T extends JWTPayload>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}
