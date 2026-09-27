import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { UploadExperience } from "@/components/upload/upload-experience";

import {
  createWebsiteStructuredData,
  serializeStructuredData,
} from "./website-structured-data";

export const dynamic = "force-dynamic";

export default function Home() {
  const structuredData = createWebsiteStructuredData(getPublicUrl("/"));
  const { maxUploadBytes } = getUploadLimits();

  return (
    <>
      <div className="page-frame">
        <SiteHeader />
        <main className="upload-shell">
          <UploadExperience initialMaxBytes={maxUploadBytes} />
        </main>
        <SiteFooter />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(structuredData),
        }}
      />
    </>
  );
}
