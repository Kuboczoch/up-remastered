import { getRecipientRequestedUpload } from "@/server/upload-requests/requested-upload";
import { RecipientRequestView } from "./recipient-request-view";

export const dynamic = "force-dynamic";

export default async function RequestedUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const now = new Date();
  const request = getRecipientRequestedUpload(token, now);
  return <RecipientRequestView request={request} token={token} now={now} />;
}
