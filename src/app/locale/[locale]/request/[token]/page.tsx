import Page from "@/app/request/[token]/content";
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
      translate(isLocale(locale) ? locale : "en", "Upload a requested file"),
    ),
  };
}
export default Page;
