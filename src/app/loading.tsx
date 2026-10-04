import { T } from "@/i18n/provider";
export default function Loading() {
  return (
    <main className="status-page">
      <div role="status" aria-live="polite">
        <p className="status-code">
          <T id="Loading" />
        </p>
        <h1>
          <T id="Please wait" />
        </h1>
        <p>
          <T id="The requested content is loading." />
        </p>
      </div>
    </main>
  );
}
