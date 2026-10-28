import { isLocale, defaultLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/messages";
import { createPageTitle } from "@/config/site";

export { default } from "@/app/decrypt/[id]/view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  return {
    title: createPageTitle(
      translate(isLocale(locale) ? locale : defaultLocale, "Decrypt your file"),
    ),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
