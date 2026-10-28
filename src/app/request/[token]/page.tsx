import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createPageTitle } from "@/config/site";
import { getRecipientRequestedUpload } from "@/server/upload-requests/requested-upload";
import { RecipientRequestView } from "./recipient-request-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: createPageTitle("Upload a requested file"),
};

export default async function RequestedUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const now = new Date();
  const request = getRecipientRequestedUpload(token, now);
  return (
    <>
      <SiteHeader />
      <RecipientRequestView request={request} token={token} now={now} />
      <SiteFooter />
    </>
  );
}
