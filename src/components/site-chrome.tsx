"use client";

import { T, useTranslation } from "@/i18n/provider";
import Image from "next/image";
import Link from "next/link";

import { siteName } from "@/config/site";
import packageMetadata from "../../package.json";

export function SiteHeader() {
  const { t } = useTranslation();
  return (
    <header className="site-header">
      <Link
        className="site-brand"
        href="/"
        aria-label={t("{siteName} home", { siteName })}
      >
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
        <T id="Request a file" />
      </Link>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <T id="Temporary by design." />
        </p>
        <nav aria-label={t("Footer")}>
          <a href="/sharex" download>
            <T id="ShareX config" />
          </a>
          <a href="/sh" download>
            <T id="Shell helper" />
          </a>
          <a
            aria-label={t("GitHub repository (opens in a new tab)")}
            href="https://github.com/Kuboczoch/up-remastered"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <span className="site-footer-version">
            v{packageMetadata.version}
          </span>
          <a
            href="https://openclipart.org/detail/285129/forrest-and-mountains-illustration"
            rel="noreferrer"
            target="_blank"
          >
            <T id="Artwork" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
