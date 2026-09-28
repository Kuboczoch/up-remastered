import "server-only";

import {
  inspectRequestedUpload,
  type UploadRequestDetails,
} from "./requested-upload";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_MAX_LIFETIME_MS = 55_000;
const RECONNECT_DELAY_MS = 2_000;

const TERMINAL_STATUSES = new Set<UploadRequestDetails["status"]>([
  "consumed",
  "expired",
  "revoked",
]);

type StatusStreamOptions = {
  heartbeatIntervalMs?: number;
  inspect?: (managementToken: string) => UploadRequestDetails | undefined;
  maxLifetimeMs?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
};

export function uploadRequestEventId(request: UploadRequestDetails): string {
  return `${request.status}:${request.statusChangedAt}`;
}

export function isTerminalUploadRequestStatus(
  status: UploadRequestDetails["status"],
): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function createUploadRequestStatusStream(
  managementToken: string,
  initial: UploadRequestDetails,
  lastEventId?: string,
  options: StatusStreamOptions = {},
): ReadableStream<Uint8Array> {
  const inspect = options.inspect ?? inspectRequestedUpload;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const maxLifetimeMs = options.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS;
  const encoder = new TextEncoder();
  let cancelStream = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let currentEventId = lastEventId;
      const timers: {
        heartbeat?: ReturnType<typeof setInterval>;
        lifetime?: ReturnType<typeof setTimeout>;
        poll?: ReturnType<typeof setInterval>;
      } = {};

      const cleanup = () => {
        if (timers.poll) clearInterval(timers.poll);
        if (timers.heartbeat) clearInterval(timers.heartbeat);
        if (timers.lifetime) clearTimeout(timers.lifetime);
        options.signal?.removeEventListener("abort", abort);
      };
      const stop = () => {
        if (closed) return false;
        closed = true;
        cleanup();
        return true;
      };
      const close = () => {
        if (stop()) controller.close();
      };
      const abort = () => close();
      const enqueue = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const publish = (request: UploadRequestDetails) => {
        const eventId = uploadRequestEventId(request);
        if (eventId !== currentEventId) {
          enqueue(
            `id: ${eventId}\nevent: status\ndata: ${JSON.stringify({ request })}\n\n`,
          );
          currentEventId = eventId;
        }
        if (isTerminalUploadRequestStatus(request.status)) close();
      };

      enqueue(`retry: ${RECONNECT_DELAY_MS}\n\n`);
      publish(initial);
      if (closed) return;

      cancelStream = () => {
        stop();
      };
      if (options.signal?.aborted) {
        close();
        return;
      }
      options.signal?.addEventListener("abort", abort, { once: true });
      timers.poll = setInterval(() => {
        const request = inspect(managementToken);
        if (!request) {
          close();
          return;
        }
        publish(request);
      }, pollIntervalMs);
      timers.heartbeat = setInterval(
        () => enqueue(": keep-alive\n\n"),
        heartbeatIntervalMs,
      );
      timers.lifetime = setTimeout(close, maxLifetimeMs);
    },
    cancel() {
      cancelStream();
    },
  });
}
