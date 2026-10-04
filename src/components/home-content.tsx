import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
import { SiteFooter } from "@/components/site-chrome";
import { UploadExperience } from "@/components/upload/upload-experience";

import {
  createWebsiteStructuredData,
  serializeStructuredData,
} from "@/app/website-structured-data";

export default function HomeContent({
  locale = "en",
}: { locale?: "en" | "pl" } = {}) {
  const structuredData = createWebsiteStructuredData(getPublicUrl("/"), locale);
  const { maxUploadBytes } = getUploadLimits();

  return (
    <>
      <div className="page-frame">
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
