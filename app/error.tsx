"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates with the server log; no customer text is sent.
    console.error("desk-render-error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="error-boundary" role="alert">
      <h1>Something went wrong in the triage desk.</h1>
      <p>
        The desk could not render. No customer message was sent anywhere; retry
        the step, and report the reference if it keeps happening.
      </p>
      {error.digest && (
        <p className="error-boundary-digest">Reference: {error.digest}</p>
      )}
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
