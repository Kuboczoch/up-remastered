import { getPublicUrl } from "@/server/config/public-url";

import {
  createWebsiteStructuredData,
  serializeStructuredData,
} from "./website-structured-data";

export const dynamic = "force-dynamic";

export default function Home() {
  const structuredData = createWebsiteStructuredData(getPublicUrl("/"));

  return (
    <main>
      <h1>hello from up - remastered</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(structuredData),
        }}
      />
    </main>
  );
}
