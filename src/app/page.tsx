import Link from "next/link";

import { getPublicUrl } from "@/server/config/public-url";
import { getUploadLimits } from "@/server/config/uploads";
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
      <main className="upload-shell">
        <header className="brand">
          <span aria-hidden="true" className="brand-mark">
            ↑
          </span>
          <div>
            <p className="eyebrow">up · remastered</p>
            <h1>Share one thing, quickly.</h1>
            <p className="lede">
              Files and text expire automatically. No account required.
            </p>
          </div>
        </header>
        <UploadExperience initialMaxBytes={maxUploadBytes} />
        <footer>
          Private by obscurity, temporary by design. Keep sensitive data
          elsewhere. <Link href="/request/new">Request a file</Link>.
        </footer>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(structuredData),
        }}
      />
    </>
  );
}
