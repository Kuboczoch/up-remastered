"use client";

import { T } from "@/i18n/provider";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status-page">
      <p className="status-code">
        <T id="Unexpected error" />
      </p>
      <h1>
        <T id="Something went wrong" />
      </h1>
      <p>
        <T id="Try the request again. No error details are exposed here." />
      </p>
      <button className="status-action" type="button" onClick={reset}>
        <T id="Try again" />
      </button>
    </main>
  );
}
