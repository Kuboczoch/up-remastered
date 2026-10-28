import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
import { SiteFooter } from "@/components/site-chrome";
import { UploadExperience } from "@/components/upload/upload-experience";

import {
  createWebsiteStructuredData,
  serializeStructuredData,
} from "./website-structured-data";

// Deployment configuration is immutable for the lifetime of this build.
export const dynamic = "error";

export default function Home() {
  const structuredData = createWebsiteStructuredData(getPublicUrl("/"));
  const { maxUploadBytes, defaultExpirationMs, maxExpirationMs } =
    getUploadLimits();

  return (
    <>
      <div className="page-frame">
        <main className="upload-shell">
          <UploadExperience
            initialMaxBytes={maxUploadBytes}
            initialExpirationHours={defaultExpirationMs / 3_600_000}
            maxExpirationHours={maxExpirationMs / 3_600_000}
          />
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
