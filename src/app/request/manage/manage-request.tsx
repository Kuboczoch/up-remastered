"use client";

import { DestructiveConfirmation } from "@/components/destructive-confirmation";

import Link from "next/link";
import { ManualCopyLink } from "@/components/manual-copy-link";
import { copyLink } from "@/lib/copy-link";
import { useTranslation } from "@/lib/i18n/provider";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatBytes,
  formatLocalDateTime,
  formatRelativeExpiry,
} from "@/lib/format";

import {
  isTerminalRequest,
  OwnerRequestLifecycle,
} from "../owner-request-lifecycle";
import styles from "../request.module.css";
import {
  statusConnectionMessage,
  useUploadRequestStatus,
  type RequestDetails,
} from "../use-upload-request-status";

type ManageResponse = {
  error?: { message?: string };
  request?: RequestDetails;
};

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const STORAGE_KEY = "up.upload-request-management-token";

function clearFragment() {
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
}

function readToken(): string | undefined {
  const hadFragment = window.location.hash.length > 0;
  const fragment = window.location.hash.slice(1);
  clearFragment();

  if (hadFragment) {
    if (!TOKEN_PATTERN.test(fragment)) {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // The stale token is ignored even when browser storage is unavailable.
      }
      return undefined;
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, fragment);
    } catch {
      // The page still works when browser storage is unavailable.
    }
    return fragment;
  }

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
    return TOKEN_PATTERN.test(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function ManageRequest() {
  const { locale, t, message } = useTranslation();
  const tokenRef = useRef<string | undefined>(undefined);
  const [managementToken, setManagementToken] = useState<string>();
  const [loadedRequest, setLoadedRequest] = useState<RequestDetails>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);
  const [manualCopyUrl, setManualCopyUrl] = useState("");
  const { connection, request } = useUploadRequestStatus(
    managementToken,
    loadedRequest,
  );

  const load = useCallback(async (managementToken: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${managementToken}` },
      });
      const body = (await response.json()) as ManageResponse;
      if (!response.ok || !body.request) {
        throw new Error(
          body.error?.message ?? "This upload request is unavailable.",
        );
      }
      setLoadedRequest(body.request);
    } catch (caught) {
      setLoadedRequest(undefined);
      setError(
        caught instanceof Error
          ? caught.message
          : "This upload request is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const importedToken = readToken();
    tokenRef.current = importedToken;
    if (importedToken)
      void Promise.resolve().then(() => {
        setManagementToken(importedToken);
        return load(importedToken);
      });
    else {
      void Promise.resolve().then(() => {
        setError(
          "Open the private owner link created with your upload request.",
        );
        setBusy(false);
      });
    }
  }, [load]);

  async function revoke() {
    const token = tokenRef.current;
    if (
      !token ||
      !request ||
      busy ||
      !["active", "retry"].includes(request.status)
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      const body = (await response.json()) as ManageResponse;
      if (!response.ok || !body.request) {
        throw new Error(body.error?.message ?? "Could not revoke the request.");
      }
      setLoadedRequest(body.request);
    } catch (caught) {
      const safeError = message(
        caught instanceof Error ? caught.message : "",
        "Could not revoke the request.",
      );
      setError("Could not revoke the request.");
      throw new Error(safeError);
    } finally {
      setBusy(false);
    }
  }

  async function copyOwnerLink() {
    const token = tokenRef.current;
    if (!token) return;
    setError("");
    const ownerUrl = `${window.location.origin}/request/manage#${token}`;
    const success = await copyLink(ownerUrl);
    setCopied(success);
    setManualCopyUrl(success ? "" : ownerUrl);
  }

  if (busy && !request) {
    return (
      <section className={styles.card} aria-busy="true">
        <h2>{t("Loading request status…")}</h2>
      </section>
    );
  }

  if (!request) {
    return (
      <section className={styles.card}>
        <h2>{t("Owner link unavailable")}</h2>
        <p className={styles.error} role="alert">
          {message(error, "This upload request is unavailable.")}
        </p>
        <Link className={styles.linkButton} href="/request/new">
          {t("Create a new request")}
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="management-status">
      <h2 id="management-status">{t("Request status")}</h2>
      <p className={styles.muted}>
        {t(
          "This private owner link is a bearer capability. Anyone with it can view this status or revoke an active request.",
        )}
      </p>
      <p className={styles.status} role="status">
        {message(request.status.replace("_", " "))}
      </p>
      <p className={styles.muted} aria-live="polite">
        {message(statusConnectionMessage(connection))}
      </p>
      <dl className={styles.details}>
        <div>
          <dt>{t("Upload limit")}</dt>
          <dd>{formatBytes(request.maxBytes, locale)}</dd>
        </div>
        <div>
          <dt>{t("Expires")}</dt>
          <dd>
            {formatRelativeExpiry(request.expiresAt, undefined, locale)} ·{" "}
            <time dateTime={request.expiresAt}>
              {formatLocalDateTime(request.expiresAt, locale)}
            </time>
          </dd>
        </div>
      </dl>
      <OwnerRequestLifecycle request={request} />
      <div className={styles.actions}>
        <button
          className={styles.linkButton}
          onClick={copyOwnerLink}
          type="button"
        >
          {copied ? t("Owner link copied") : t("Copy owner link")}
        </button>
        {isTerminalRequest(request.status) ? (
          <Link className={styles.linkButton} href="/request/new">
            {t("Create a new request")}
          </Link>
        ) : (
          <DestructiveConfirmation
            className={styles.linkButton}
            disabled={busy || !["active", "retry"].includes(request.status)}
            onConfirm={revoke}
            label={t("Revoke request")}
            title={t("Revoke upload request?")}
            description={t(
              "Revoke the upload request expiring {date} ({size} limit)? Its shared upload link will stop working. This cannot be undone; create a new request instead.",
              {
                date: formatLocalDateTime(request.expiresAt, locale),
                size: formatBytes(request.maxBytes, locale),
              },
            )}
            confirmLabel={t("Confirm revoke request")}
          />
        )}
        <button
          className={styles.linkButton}
          disabled={busy}
          onClick={() => tokenRef.current && void load(tokenRef.current)}
          type="button"
        >
          {t("Refresh status")}
        </button>
      </div>
      {manualCopyUrl && <ManualCopyLink value={manualCopyUrl} />}
      {error ? (
        <p className={styles.error} role="alert">
          {message(error, "This upload request is unavailable.")}
        </p>
      ) : null}
    </section>
  );
}
