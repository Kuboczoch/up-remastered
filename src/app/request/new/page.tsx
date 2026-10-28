import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";
import { getUploadLimits } from "@/server/config/uploads";
import { formatBytes } from "@/lib/format";

import styles from "../request.module.css";
import { CreateRequestForm } from "./create-request-form";

// This page intentionally uses inherited URL metadata from build time.
export const dynamic = "force-static";
export const metadata: Metadata = {
  title: createPageTitle("Request a file"),
};

export default function NewUploadRequestPage() {
  const { maxUploadBytes, maxExpirationMs } = getUploadLimits();
  return (
    <>
      <SiteHeader />
      <main className={styles.shell}>
        <header className={styles.header}>
          {/* Document navigation keeps this form visible until home is ready. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">← Back to uploads</a>
          <h1>Request a file.</h1>
          <p>
            Create a private, single-use link for someone else to upload one
            file.
          </p>
          <p
            data-max-bytes={maxUploadBytes}
            data-max-hours={maxExpirationMs / 3_600_000}
          >
            Deployment limits: {formatBytes(maxUploadBytes)} per file; up to{" "}
            {maxExpirationMs / 3_600_000} hours. Current server limits are
            checked before creating a request.
          </p>
        </header>
        <CreateRequestForm />
      </main>
      <SiteFooter />
    </>
  );
}
