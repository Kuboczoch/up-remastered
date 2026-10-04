import Link from "next/link";
import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";
import { getRecipientRequestAvailability } from "@/server/upload-requests/requested-upload";

import styles from "../request.module.css";
import { RequestedUploadForm } from "./requested-upload-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: createPageTitle("Upload a requested file"),
};

export default async function RequestedUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = getRecipientRequestAvailability(token);

  return (
    <>
      <SiteHeader />
      <main className={styles.shell}>
        <header className={styles.header}>
          <Link href="/">← Home</Link>
          <h1>Upload a requested file.</h1>
        </header>
        {"maxBytes" in request ? (
          <>
            {request.status === "retry" && (
              <p>
                The previous upload did not complete. You can try again with
                this request.
              </p>
            )}
            <RequestedUploadForm
              maxBytes={request.maxBytes}
              expiresAt={request.expiresAt}
              token={token}
            />
          </>
        ) : (
          <section className={styles.card}>
            <h2>Upload request unavailable</h2>
            <p>
              {request.status === "expired"
                ? "This request has expired. Ask the requester for a new request link."
                : request.status === "revoked"
                  ? "This request was revoked. Ask the requester for a new request link."
                  : request.status === "consumed"
                    ? "A file was already delivered using this request. Ask the requester for a new request link to send another file."
                    : request.status === "in_progress"
                      ? "Another upload is in progress. Wait and refresh to check whether this request becomes available again."
                      : "This request link is invalid. Check the complete link or ask the requester for a new request link."}
            </p>
            {request.status === "in_progress" && (
              <a className={styles.linkButton} href={`/request/${token}`}>
                Refresh request
              </a>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
