import { describe, expect, it } from "vitest";
import { connectionString } from "@/db";

describe("connectionString", () => {
  it("uses libpq SSL semantics for Supabase hosts", () => {
    const url = new URL(
      connectionString("postgres://postgres.abc:p%40ss%2Fword@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x"),
    );
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("uselibpqcompat")).toBe("true");
    expect(url.searchParams.get("supa")).toBe("base-pooler.x");
    expect(decodeURIComponent(url.password)).toBe("p@ss/word");
  });

  it("adds encryption to Supabase URLs without sslmode", () => {
    const url = new URL(connectionString("postgresql://postgres:pw@db.abc.supabase.co:5432/postgres"));
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("uselibpqcompat")).toBe("true");
  });

  it("leaves explicit SSL choices and other hosts alone", () => {
    const strict = "postgres://u:p@db.abc.supabase.co/postgres?sslmode=verify-full&sslrootcert=/ca.pem";
    expect(connectionString(strict)).toBe(strict);
    const neon = "postgres://u:p@ep-x.us-east-2.aws.neon.tech/db?sslmode=require";
    expect(connectionString(neon)).toBe(neon);
    expect(connectionString("not a url")).toBe("not a url");
  });
});
