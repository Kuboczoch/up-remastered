"use client";

import { useState, type FormEvent } from "react";

import styles from "../request.module.css";

type CreatedRequest = {
  expiresAt: string;
  managementToken: string;
  maxBytes: number;
  status: string;
  uploadUrl: string;
};

export function CreateRequestForm({
  maxUploadBytes,
}: {
  maxUploadBytes: number;
}) {
  const [created, setCreated] = useState<CreatedRequest>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaultExpiration] = useState(() => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    expiresAt.setMinutes(
      expiresAt.getMinutes() - expiresAt.getTimezoneOffset(),
    );
    return expiresAt.toISOString().slice(0, 16);
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/upload-requests", {
        body: JSON.stringify({
          expiresAt: new Date(String(form.get("expiresAt"))).toISOString(),
          maxBytes: Number(form.get("maxBytes")),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as CreatedRequest & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(body.error?.message ?? "Request failed.");
      setCreated(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!created) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/upload-requests/manage", {
        headers: { authorization: `Bearer ${created.managementToken}` },
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not revoke the request.");
      const body = (await response.json()) as { request: { status: string } };
      setCreated({ ...created, status: body.request.status });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <section className={styles.card} aria-labelledby="request-created">
        <h2 id="request-created">Upload request created</h2>
        <p className={styles.result}>
          Send this upload link:{" "}
          <a href={created.uploadUrl}>{created.uploadUrl}</a>
        </p>
        <p className={styles.result}>
          <strong>Owner management token (shown once):</strong>{" "}
          <code>{created.managementToken}</code>
        </p>
        <p>
          Save the management token now. It can inspect or revoke the request
          and cannot be recovered by the server.
        </p>
        <p role="status">Status: {created.status}</p>
        <div className={styles.actions}>
          <button
            className={styles.button}
            disabled={busy || created.status === "revoked"}
            onClick={revoke}
            type="button"
          >
            Revoke request
          </button>
          <button
            className={styles.button}
            onClick={() => setCreated(undefined)}
            type="button"
          >
            Create another
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <label className={styles.field}>
        Request expires
        <input
          defaultValue={defaultExpiration}
          name="expiresAt"
          required
          type="datetime-local"
        />
      </label>
      <label className={styles.field}>
        Maximum upload size in bytes
        <input
          defaultValue={maxUploadBytes}
          max={maxUploadBytes}
          min="1"
          name="maxBytes"
          required
          step="1"
          type="number"
        />
      </label>
      <p className={styles.muted}>
        The link accepts one successful upload, up to {maxUploadBytes} bytes.
      </p>
      <button className={styles.button} disabled={busy} type="submit">
        {busy ? "Creating…" : "Create upload request"}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
