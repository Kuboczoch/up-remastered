import Image from "next/image";
import Link from "next/link";

import { siteName } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label={`${siteName} home`}>
        <Image
          alt=""
          aria-hidden="true"
          className="site-brand-mark"
          height={34}
          priority
          src="/brand-mark.svg"
          width={34}
        />
        <strong>{siteName}</strong>
      </Link>
      <Link className="outline-button" href="/request/new">
        Request a file
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>Temporary by design.</p>
        <nav aria-label="Footer">
          <Link href="/request/new">Request a file</Link>
          <a
            aria-label="GitHub repository (opens in a new tab)"
            href="https://github.com/Kuboczoch/up-remastered"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <span className="site-footer-version">v1.1.0</span>
          <a
            href="https://openclipart.org/detail/285129/forrest-and-mountains-illustration"
            rel="noreferrer"
            target="_blank"
          >
            Artwork
          </a>
        </nav>
      </div>
    </footer>
  );
}
