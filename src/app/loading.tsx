export default function Loading() {
  return (
    <main className="status-page">
      <div role="status" aria-live="polite">
        <p className="status-code">Loading</p>
        <h1>Please wait</h1>
        <p>The requested content is loading.</p>
      </div>
    </main>
  );
}
