"use client";

import { useState, useTransition } from "react";
import { beginExamAction } from "./actions";

export function StartButton({ token, label }: { token: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        className="btn-primary w-full py-3 text-base"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await beginExamAction(token);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Starting…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
