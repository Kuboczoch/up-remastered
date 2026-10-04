import Page from "@/app/decrypt/[id]/content";
import { translate } from "@/i18n/messages";
import { isLocale } from "@/i18n/locale";
import { createPageTitle } from "@/config/site";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
    title: createPageTitle(
      translate(isLocale(locale) ? locale : "en", "Decrypt your file"),
    ),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
export default Page;
