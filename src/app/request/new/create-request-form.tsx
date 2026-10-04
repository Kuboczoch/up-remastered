"use client";
import { useTranslation } from "@/i18n/provider";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { parseByteQuantity, type ByteUnit } from "@/lib/format";
import { apiErrorKey } from "@/i18n/messages";

import styles from "../request.module.css";
import { CopyRequestLink } from "../copy-request-link";
import { RequestOwnerStatus } from "../request-owner-status";
import {
  statusConnectionMessage,
  useUploadRequestStatus,
  type RequestDetails,
} from "../use-upload-request-status";

type CreatedRequest = RequestDetails & {
  managementUrl: string;
  managementToken: string;
  uploadUrl: string;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EXPIRATION_PRESETS = [
  { label: "1 hour", value: HOUR },
  { label: "1 day", value: DAY },
  { label: "7 days", value: 7 * DAY },
];
const SIZE_PRESETS = [1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 1024 ** 3];
const BYTE_UNITS: ByteUnit[] = ["B", "KiB", "MiB", "GiB"];

function subscribeToHydration() {
  return () => undefined;
}

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CreateRequestForm() {
  const { t, formatBytes, formatDuration } = useTranslation();
  const [limits, setLimits] = useState<{
    maxExpirationMs: number;
    maxUploadBytes: number;
  } | null>(null);
  const [limitsError, setLimitsError] = useState(false);
  const [limitsAttempt, setLimitsAttempt] = useState(0);
  const maxExpirationMs = limits?.maxExpirationMs ?? 0;
  const maxUploadBytes = limits?.maxUploadBytes ?? 0;
  const expirationPresets = useMemo(() => {
    const allowed = EXPIRATION_PRESETS.filter(
      ({ value }) => value <= maxExpirationMs,
    ).map(({ value }) => ({ value, label: formatDuration(value) }));
    if (!allowed.some(({ value }) => value === maxExpirationMs)) {
      allowed.push({
        label: t("Maximum ({duration})", {
          duration: formatDuration(maxExpirationMs),
        }),
        value: maxExpirationMs,
      });
    }
    return allowed;
  }, [maxExpirationMs, t, formatDuration]);
  const sizePresets = useMemo(
    () =>
      Array.from(
        new Set([
          ...SIZE_PRESETS.filter((value) => value < maxUploadBytes),
          maxUploadBytes,
        ]),
      ),
    [maxUploadBytes],
  );
  const [created, setCreated] = useState<CreatedRequest>();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [expirationChoice, setExpirationChoice] = useState(() =>
    String(expirationPresets[0]?.value ?? maxExpirationMs),
  );
  const [customExpiration, setCustomExpiration] = useState("");
  const [customExpirationMax, setCustomExpirationMax] = useState("");
  const [sizeChoice, setSizeChoice] = useState(String(maxUploadBytes));
  const [customSize, setCustomSize] = useState(String(maxUploadBytes));
  const [customSizeUnit, setCustomSizeUnit] = useState<ByteUnit>("B");

  useEffect(() => {
    const controller = new AbortController();
    async function loadLimits() {
      try {
        const response = await fetch("/api/configuration", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(t("Configuration unavailable."));
        const configuration = await response.json();
        if (
          !Number.isFinite(configuration.maxFileLifetime) ||
          configuration.maxFileLifetime <= 0 ||
          !Number.isSafeInteger(configuration.maxTemporaryFileSize) ||
          configuration.maxTemporaryFileSize <= 0
        ) {
          throw new Error(t("Invalid server limits."));
        }
        if (controller.signal.aborted) return;
        setLimits({
          maxExpirationMs: configuration.maxFileLifetime,
          maxUploadBytes: configuration.maxTemporaryFileSize,
        });
        setExpirationChoice(
          String(Math.min(HOUR, configuration.maxFileLifetime)),
        );
        setSizeChoice(String(configuration.maxTemporaryFileSize));
        setCustomSize(String(configuration.maxTemporaryFileSize));
      } catch {
        if (!controller.signal.aborted) setLimitsError(true);
      }
    }
    void loadLimits();
    return () => controller.abort();
  }, [limitsAttempt, t]);
  const { connection, request: liveRequest } = useUploadRequestStatus(
    created?.managementToken,
    created,
  );

  function selectExpiration(value: string) {
    setExpirationChoice(value);
    if (value !== "custom") return;

    const current = Date.now();
    const defaultDuration = Math.min(HOUR, maxExpirationMs);
    setCustomExpiration(toLocalInputValue(new Date(current + defaultDuration)));
    setCustomExpirationMax(
      toLocalInputValue(new Date(current + maxExpirationMs)),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!limits || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");

    try {
      const submittedAt = Date.now();
      const expiresAt =
        expirationChoice === "custom"
          ? new Date(customExpiration)
          : new Date(submittedAt + Number(expirationChoice));
      if (
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= submittedAt ||
        expiresAt.getTime() > submittedAt + maxExpirationMs
      ) {
        setError(
          t("Expiration must be in the future and within {duration}.", {
            duration: formatDuration(maxExpirationMs),
          }),
        );
        return;
      }

      const maxBytes =
        sizeChoice === "custom"
          ? parseByteQuantity(customSize, customSizeUnit, maxUploadBytes)
          : Number(sizeChoice);
      if (
        !Number.isSafeInteger(maxBytes) ||
        maxBytes < 1 ||
        maxBytes > maxUploadBytes
      ) {
        throw new RangeError(
          t("Size must be between 1 byte and {size}.", {
            size: formatBytes(maxUploadBytes),
          }),
        );
      }

      const response = await fetch("/api/upload-requests", {
        body: JSON.stringify({
          expiresAt: expiresAt.toISOString(),
          maxBytes,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as CreatedRequest & {
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(t(apiErrorKey(body, "Request failed.")));
        return;
      }
      if (
        !body ||
        typeof body.managementToken !== "string" ||
        typeof body.managementUrl !== "string" ||
        typeof body.uploadUrl !== "string" ||
        !Number.isSafeInteger(body.maxBytes) ||
        !Number.isFinite(Date.parse(body.expiresAt))
      ) {
        setError(t("Request failed."));
        return;
      }
      setCreated(body);
    } catch (caught) {
      setError(
        caught instanceof RangeError
          ? t("Size must be between 1 byte and {size}.", {
              size: formatBytes(maxUploadBytes),
            })
          : t("Request failed."),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (created) {
    const displayedRequest = liveRequest ?? created;
    return (
      <section className={styles.card} aria-labelledby="request-created">
        <h2 id="request-created">{t("Upload request created")}</h2>
        <p className={styles.result}>
          {t("Send this upload link:")}{" "}
          <a href={created.uploadUrl}>{created.uploadUrl}</a>
        </p>
        <CopyRequestLink
          label={t("Copy upload link")}
          value={created.uploadUrl}
        />
        <p className={styles.result}>
          <strong>{t("Save this private owner link:")}</strong>{" "}
          <a href={created.managementUrl}>{created.managementUrl}</a>
        </p>
        <CopyRequestLink
          label={t("Copy owner link")}
          value={created.managementUrl}
        />
        <p>
          {t(
            "This link can inspect or revoke the request and cannot be recovered by the server.",
          )}{" "}
        </p>
        <RequestOwnerStatus
          request={displayedRequest}
          token={created.managementToken}
          onUpdate={(update) => setCreated({ ...created, ...update })}
        />
        <p className={styles.muted} aria-live="polite">
          {t(statusConnectionMessage(connection))}
        </p>
        <div className={styles.actions}>
          <button
            className={styles.button}
            onClick={() => setCreated(undefined)}
            type="button"
          >
            {t("Create another")}{" "}
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      {!limits && (
        <div>
          <p role={limitsError ? "alert" : "status"}>
            {limitsError
              ? t("Could not load server limits. Please retry.")
              : t("Loading server limits…")}
          </p>
          {limitsError && (
            <button
              className="outline-button"
              onClick={() => {
                setLimitsError(false);
                setLimitsAttempt((attempt) => attempt + 1);
              }}
              type="button"
            >
              {t("Retry loading limits")}{" "}
            </button>
          )}
        </div>
      )}
      <label className={styles.field}>
        {t("Request expires")}{" "}
        <select
          disabled={!hydrated || !limits}
          name="expirationPreset"
          onChange={(event) => selectExpiration(event.target.value)}
          value={expirationChoice}
        >
          {!limits && <option value="0">{t("Loading server limits…")}</option>}
          {limits &&
            expirationPresets.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          <option value="custom">{t("Custom date and time")}</option>
        </select>
      </label>
      {expirationChoice === "custom" ? (
        <label className={styles.field}>
          {t("Custom expiration date and time")}{" "}
          <input
            max={customExpirationMax}
            name="expiresAt"
            onChange={(event) => setCustomExpiration(event.target.value)}
            required
            type="datetime-local"
            value={customExpiration}
          />
        </label>
      ) : null}
      <label className={styles.field}>
        {t("Maximum upload size")}{" "}
        <select
          disabled={!hydrated || !limits}
          name="sizePreset"
          onChange={(event) => setSizeChoice(event.target.value)}
          value={sizeChoice}
        >
          {!limits && <option value="0">{t("Loading server limits…")}</option>}
          {limits &&
            sizePresets.map((bytes) => (
              <option key={bytes} value={bytes}>
                {bytes === maxUploadBytes ? t("Server maximum: ") : ""}
                {formatBytes(bytes)}
              </option>
            ))}
          <option value="custom">{t("Custom size")}</option>
        </select>
      </label>
      {sizeChoice === "custom" ? (
        <div className={styles.inlineFields}>
          <label className={styles.field}>
            {t("Size amount")}{" "}
            <input
              inputMode="decimal"
              min="0"
              name="maxBytes"
              onChange={(event) => setCustomSize(event.target.value)}
              required
              step="any"
              type="number"
              value={customSize}
            />
          </label>
          <label className={styles.field}>
            {t("Size unit")}{" "}
            <select
              name="sizeUnit"
              onChange={(event) =>
                setCustomSizeUnit(event.target.value as ByteUnit)
              }
              value={customSizeUnit}
            >
              {BYTE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <p className={styles.muted}>
        {t("The link accepts one successful upload.")}{" "}
        {limits && (
          <>
            {" "}
            {t("Server maximum:")} {formatBytes(maxUploadBytes)}.
          </>
        )}
      </p>
      <button
        className={styles.button}
        disabled={!hydrated || !limits || busy}
        type="submit"
      >
        {busy ? t("Creating…") : t("Create upload request")}
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
