import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <p className="status-code">404</p>
      <h1>Page not found</h1>
      <p>The requested page or file is unavailable.</p>
      <Link className="status-action" href="/">
        Return home
      </Link>
    </main>
  );
}
