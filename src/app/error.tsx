"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status-page">
      <p className="status-code">Unexpected error</p>
      <h1>Something went wrong</h1>
      <p>Try the request again. No error details are exposed here.</p>
      <button className="status-action" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
