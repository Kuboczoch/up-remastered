import { T } from "@/i18n/provider";
import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";

import styles from "../request.module.css";
import { CreateRequestForm } from "./create-request-form";

// This page intentionally uses inherited URL metadata from build time.
export const dynamic = "force-static";
export const metadata: Metadata = {
  title: createPageTitle("Request a file"),
};

export default function NewUploadRequestPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.shell}>
        <header className={styles.header}>
          {/* Document navigation keeps this form visible until home is ready. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">
            <T id="← Back to uploads" />
          </a>
          <h1>
            <T id="Request a file." />
          </h1>
          <p>
            <T id="Create a private, single-use link for someone else to upload one file." />
          </p>
        </header>
        <CreateRequestForm />
      </main>
      <SiteFooter />
    </>
  );
}
