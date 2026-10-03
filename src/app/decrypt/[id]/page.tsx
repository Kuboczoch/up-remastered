import type { Metadata } from "next";
import { DecryptExperience } from "@/components/download/decrypt-experience";
import { SiteFooter } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Decrypt your file · Up",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function DecryptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="page-frame">
      <main className="upload-shell">
        <DecryptExperience key={id} id={id} />
      </main>
      <SiteFooter />
    </div>
  );
}
