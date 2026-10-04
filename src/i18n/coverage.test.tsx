import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "./provider";
import { UploadExperience } from "@/components/upload/upload-experience";
import { CreateRequestForm } from "@/app/request/new/create-request-form";
import { ManageRequest } from "@/app/request/manage/manage-request";
import { RequestedUploadForm } from "@/app/request/[token]/requested-upload-form";
import { RequestOwnerStatus } from "@/app/request/request-owner-status";
import { ManualCopyLink } from "@/components/manual-copy-link";
import { translateMessage } from "./messages";

const request = {
  createdAt: "2026-10-01T10:00:00Z",
  expiresAt: "2026-10-05T10:00:00Z",
  maxBytes: 1536,
  statusChangedAt: "2026-10-01T10:00:00Z",
};
function polish(node: React.ReactNode) {
  return renderToStaticMarkup(
    <LocaleProvider locale="pl">{node}</LocaleProvider>,
  );
}
test.each([
  [
    <UploadExperience key="upload" initialMaxBytes={1536} />,
    "Wybierz plik",
    "Choose file",
  ],
  [<CreateRequestForm key="create" />, "Prośba wygasa", "Request expires"],
  [
    <ManageRequest key="manage" />,
    "Ładowanie stanu prośby",
    "Loading request status",
  ],
  [
    <RequestedUploadForm
      key="request"
      token={"a".repeat(64)}
      maxBytes={1536}
    />,
    "Maksymalnie",
    "Maximum",
  ],
  [
    <ManualCopyLink key="manual" url="https://example.org/#key=unchanged" />,
    "Pełny link",
    "Complete link",
  ],
])(
  "initial Polish SSR translates visible and accessible copy",
  (node, translated, english) => {
    const html = polish(node);
    expect(html).toContain(translated);
    expect(html).not.toContain(english);
  },
);
test.each([
  ["active", "Oczekiwanie na plik"],
  ["retry", "Poprzednie przesyłanie"],
  ["in_progress", "Trwa przesyłanie"],
  ["consumed", "Plik dostarczony"],
  ["expired", "Ta prośba wygasła"],
  ["revoked", "Ta prośba została unieważniona"],
] as const)("owner status %s is translated on SSR", (status, expected) => {
  expect(
    polish(
      <RequestOwnerStatus
        request={{ ...request, status, uploadId: "unchanged-id" }}
        token="secret"
        onUpdate={() => {}}
      />,
    ),
  ).toContain(expected);
});
test("untrusted API errors never disclose machine codes or remote sensitive copy", () => {
  expect(translateMessage("pl", "SQLITE_ERROR secret-token")).toBe(
    "Coś poszło nie tak",
  );
});
