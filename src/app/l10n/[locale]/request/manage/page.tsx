import { createPageTitle } from "@/config/site";
import { translate } from "@/lib/i18n/messages";
import { isLocale, defaultLocale } from "@/lib/i18n/locale";

export { default } from "@/app/request/manage/view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return {
    title: createPageTitle(
      translate(
        isLocale(locale) ? locale : defaultLocale,
        "Manage upload request",
      ),
    ),
  };
}
export const dynamic = "error";
