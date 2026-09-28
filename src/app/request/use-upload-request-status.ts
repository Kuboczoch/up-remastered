"use client";

import { useEffect, useRef, useState } from "react";

export type RequestStatus =
  | "active"
  | "consumed"
  | "expired"
  | "in_progress"
  | "retry"
  | "revoked";

export type RequestDetails = {
  createdAt: string;
  expiresAt: string;
  maxBytes: number;
  status: RequestStatus;
  statusChangedAt: string;
  uploadId?: string;
};

export type StatusConnection =
  | "connecting"
  | "live"
  | "reconnecting"
  | "stopped"
  | "unavailable";

const RECONNECT_DELAY_MS = 2_000;
const TERMINAL_STATUSES = new Set<RequestStatus>([
  "consumed",
  "expired",
  "revoked",
]);

function isRequestDetails(value: unknown): value is RequestDetails {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<RequestDetails>;
  return (
    typeof request.createdAt === "string" &&
    typeof request.expiresAt === "string" &&
    typeof request.maxBytes === "number" &&
    typeof request.statusChangedAt === "string" &&
    typeof request.status === "string" &&
    [
      "active",
      "consumed",
      "expired",
      "in_progress",
      "retry",
      "revoked",
    ].includes(request.status) &&
    (request.uploadId === undefined || typeof request.uploadId === "string")
  );
}

export function parseStatusEvent(block: string): RequestDetails | undefined {
  const lines = block.replaceAll("\r", "").split("\n");
  if (!lines.includes("event: status")) return undefined;
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return undefined;

  try {
    const payload = JSON.parse(data) as { request?: unknown };
    return isRequestDetails(payload.request) ? payload.request : undefined;
  } catch {
    return undefined;
  }
}

export function statusConnectionMessage(connection: StatusConnection): string {
  switch (connection) {
    case "connecting":
      return "Connecting for live updates…";
    case "live":
      return "Live updates connected.";
    case "reconnecting":
      return "Live updates disconnected. Reconnecting…";
    case "stopped":
      return "Live updates finished.";
    case "unavailable":
      return "Live updates unavailable. Refresh to check status.";
  }
}

export function useUploadRequestStatus(
  managementToken: string | undefined,
  initialRequest: RequestDetails | undefined,
): { connection: StatusConnection; request: RequestDetails | undefined } {
  const initialRef = useRef(initialRequest);
  initialRef.current = initialRequest;
  const [request, setRequest] = useState(initialRequest);
  const [connection, setConnection] = useState<StatusConnection>(
    initialRequest && TERMINAL_STATUSES.has(initialRequest.status)
      ? "stopped"
      : "connecting",
  );

  useEffect(() => {
    const initial = initialRef.current;
    setRequest(initial);
    if (!managementToken || !initial) {
      setConnection("stopped");
      return;
    }
    if (TERMINAL_STATUSES.has(initial.status)) {
      setConnection("stopped");
      return;
    }

    let cancelled = false;
    let controller: AbortController | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const reconnect = () => {
      if (cancelled) return;
      setConnection("reconnecting");
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    const connect = async () => {
      controller = new AbortController();
      setConnection((current) =>
        current === "reconnecting" ? current : "connecting",
      );

      try {
        const response = await fetch("/api/upload-requests/manage/events", {
          headers: { authorization: `Bearer ${managementToken}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          if (!cancelled) setConnection("unavailable");
          return;
        }

        setConnection("live");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let terminal = false;

        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const blocks = buffer.replaceAll("\r\n", "\n").split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const update = parseStatusEvent(block);
            if (!update) continue;
            setRequest(update);
            if (TERMINAL_STATUSES.has(update.status)) terminal = true;
          }
        }

        if (!cancelled) {
          if (terminal) setConnection("stopped");
          else reconnect();
        }
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          reconnect();
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [
    initialRequest?.status,
    initialRequest?.statusChangedAt,
    managementToken,
  ]);

  return { connection, request };
}
