import { T } from "@/i18n/provider";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <p className="status-code">404</p>
      <h1>
        <T id="Page not found" />
      </h1>
      <p>
        <T id="The requested page or file is unavailable." />
      </p>
      <Link className="status-action" href="/">
        <T id="Return home" />
      </Link>
    </main>
  );
}
