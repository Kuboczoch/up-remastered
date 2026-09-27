import Link from "next/link";
import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";
import { getUploadLimits } from "@/server/config/uploads";

import styles from "../request.module.css";
import { CreateRequestForm } from "./create-request-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: createPageTitle("Request a file"),
};

export default function NewUploadRequestPage() {
  const { maxExpirationMs, maxUploadBytes } = getUploadLimits();

  return (
    <>
      <SiteHeader />
      <main className={styles.shell}>
        <header className={styles.header}>
          <Link href="/">← Back</Link>
          <h1>Request a file.</h1>
          <p>
            Create a private, single-use link for someone else to upload one
            file.
          </p>
        </header>
        <CreateRequestForm
          maxExpirationMs={maxExpirationMs}
          maxUploadBytes={maxUploadBytes}
        />
      </main>
      <SiteFooter />
    </>
  );
}
