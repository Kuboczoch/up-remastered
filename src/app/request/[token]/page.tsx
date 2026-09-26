import Link from "next/link";

import { getActiveRequestedUpload } from "@/server/upload-requests/requested-upload";

import styles from "../request.module.css";
import { RequestedUploadForm } from "./requested-upload-form";

export const dynamic = "force-dynamic";

export default async function RequestedUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = getActiveRequestedUpload(token);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link href="/">← Home</Link>
        <h1>Upload a requested file</h1>
      </header>
      {request ? (
        <RequestedUploadForm maxBytes={request.maxBytes} token={token} />
      ) : (
        <section className={styles.card}>
          <h2>Upload request unavailable</h2>
          <p>
            This link is invalid, expired, revoked, already used, or currently
            in use.
          </p>
        </section>
      )}
    </main>
  );
}
