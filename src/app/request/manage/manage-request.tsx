"use client";
import { useTranslation } from "@/i18n/provider";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CopyRequestLink } from "../copy-request-link";
import { RequestOwnerStatus } from "../request-owner-status";

import styles from "../request.module.css";
import {
  statusConnectionMessage,
  useUploadRequestStatus,
  type RequestDetails,
  isRequestDetails,
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
  const { t } = useTranslation();
  const tokenRef = useRef<string | undefined>(undefined);
  const [managementToken, setManagementToken] = useState<string>();
  const [loadedRequest, setLoadedRequest] = useState<RequestDetails>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const { connection, request } = useUploadRequestStatus(
    managementToken,
    loadedRequest,
  );

  const load = useCallback(
    async (managementToken: string) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/upload-requests/manage", {
          headers: { authorization: `Bearer ${managementToken}` },
        });
        const body = (await response.json()) as ManageResponse;
        if (!response.ok || !isRequestDetails(body?.request)) {
          throw new Error(t("This upload request is unavailable."));
        }
        setLoadedRequest(body.request);
      } catch {
        setLoadedRequest(undefined);
        setError(t("This upload request is unavailable."));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

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
          t("Open the private owner link created with your upload request."),
        );
        setBusy(false);
      });
    }
  }, [load, t]);

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
          {error}
        </p>
        <Link className={styles.linkButton} href="/request/new">
          {t("Create a new request")}{" "}
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
        )}{" "}
      </p>
      <RequestOwnerStatus
        request={request}
        token={managementToken!}
        onUpdate={setLoadedRequest}
      />
      <p className={styles.muted} aria-live="polite">
        {t(statusConnectionMessage(connection))}
      </p>
      <CopyRequestLink
        label={t("Copy owner link")}
        value={`${window.location.origin}${window.location.pathname}#${managementToken}`}
      />
      <div className={styles.actions}>
        <button
          className={styles.linkButton}
          disabled={busy}
          onClick={() => tokenRef.current && void load(tokenRef.current)}
          type="button"
        >
          {t("Refresh status")}{" "}
        </button>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
