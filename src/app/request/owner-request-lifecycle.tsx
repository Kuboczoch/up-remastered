import { useTranslation } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type {
  RequestDetails,
  RequestStatus,
} from "./use-upload-request-status";

export function isTerminalRequest(status: RequestStatus): boolean {
  return ["consumed", "expired", "revoked"].includes(status);
}

const lifecycleMessages: Record<RequestStatus, MessageKey> = {
  active: "Waiting for upload.",
  retry:
    "Waiting for upload. The previous attempt failed; the recipient can try the same upload link again.",
  in_progress: "Upload in progress. The file is not available yet.",
  consumed:
    "Upload received. The recipient link has been used and cannot accept another file.",
  revoked:
    "This request was revoked. Its upload link can no longer be used. Create a new request to receive a file.",
  expired:
    "This request expired without receiving a file. Create a new request to receive a file.",
};

export function OwnerRequestLifecycle({
  request,
}: {
  request: RequestDetails;
}) {
  const { t } = useTranslation();
  return (
    <>
      <p aria-live="polite">{t(lifecycleMessages[request.status])}</p>
      {request.status === "consumed" && request.uploadId ? (
        <p>
          {t("Uploaded file:")}{" "}
          <a href={`/${request.uploadId}`}>{t("Open file")}</a>
        </p>
      ) : null}
    </>
  );
}
