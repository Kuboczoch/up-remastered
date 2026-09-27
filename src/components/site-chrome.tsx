import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="up remastered home">
        <strong>up</strong>
        <span>remastered</span>
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
      <span>Temporary by design.</span>
      <nav aria-label="Footer">
        <a href="https://github.com/Kuboczoch/up-remastered">GitHub</a>
        <span>v1.1.0</span>
        <a
          href="https://openclipart.org/detail/285129/forrest-and-mountains-illustration"
          rel="noreferrer"
          target="_blank"
        >
          Artwork
        </a>
      </nav>
    </footer>
  );
}
