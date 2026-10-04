import Page from "@/app/request/manage/content";
import { translate } from "@/i18n/messages";
import { isLocale } from "@/i18n/locale";
import { createPageTitle } from "@/config/site";
export const dynamic = "force-static";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
    title: createPageTitle(
      translate(isLocale(locale) ? locale : "en", "Manage upload request"),
    ),
  };
}
export default Page;
