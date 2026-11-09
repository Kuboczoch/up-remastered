import RequestedUploadPage from "@/app/request/[token]/view";
import { createPageTitle } from "@/config/site";
import { isLocale, defaultLocale } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/messages";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return {
    title: createPageTitle(
      translate(
        isLocale(locale) ? locale : defaultLocale,
        "Upload a requested file",
      ),
    ),
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  return (
    <RequestedUploadPage
      params={params}
      locale={isLocale(locale) ? locale : defaultLocale}
    />
  );
}

export const dynamic = "force-dynamic";
