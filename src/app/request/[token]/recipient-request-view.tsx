import { formatLocalDateTime, formatRelativeExpiry } from "@/lib/format";
import { defaultLocale, type Locale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/messages";
import type { RecipientRequestedUpload } from "@/server/upload-requests/requested-upload";
import styles from "../request.module.css";
import { RequestedUploadForm } from "./requested-upload-form";

const unavailable = {
  invalid: [
    "This upload request is invalid",
    "Check the link with the person who sent it, or ask them for a new request.",
  ],
  in_progress: [
    "An upload is already in progress",
    "Wait for the current upload to finish, then refresh this page. Do not start another upload while it is busy.",
  ],
  consumed: [
    "This upload request has already been used",
    "This single-use link cannot accept another file. Ask the sender for a new request if you need to send another file.",
  ],
  revoked: [
    "This upload request was revoked",
    "The sender cancelled this request. Ask them for a new request to upload a file.",
  ],
  expired: [
    "This upload request has expired",
    "This link no longer accepts files. Ask the sender for a new request.",
  ],
} as const;

export function RecipientRequestView({
  request,
  token,
  now,
  locale = defaultLocale,
}: {
  request: RecipientRequestedUpload;
  token: string;
  now: Date;
  locale?: Locale;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  if (!("maxBytes" in request)) {
    const [title, guidance] = unavailable[request.status];
    return (
      <main className={styles.shell}>
        <header className={styles.header}>
          {/* Reload the public URL so history restores localized metadata. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">{t("← Home")}</a>
          <h1>{t(title)}</h1>
        </header>
        <section className={styles.card}>
          <p>{t(guidance)}</p>
          {request.status === "in_progress" ? (
            <a href={`/request/${token}`}>{t("Refresh request status")}</a>
          ) : null}
        </section>
      </main>
    );
  }
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        {/* Reload the public URL so history restores localized metadata. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">{t("← Home")}</a>
        <h1>{t("Send a requested file")}</h1>
        <p>
          {translate(locale, "Expires {expiry}", {
            expiry: formatRelativeExpiry(request.expiresAt, now, locale),
          })}{" "}
          (
          <time dateTime={request.expiresAt}>
            {formatLocalDateTime(
              request.expiresAt,
              locale === "en" ? "en-GB" : locale,
              "UTC",
            )}{" "}
            UTC
          </time>
          ).
        </p>
      </header>
      {request.status === "retry" ? (
        <p>
          {t(
            "The previous upload did not complete. You can choose a file and try again before this request expires.",
          )}
        </p>
      ) : null}
      <RequestedUploadForm maxBytes={request.maxBytes} token={token} />
    </main>
  );
}
