import { createPageTitle } from "@/config/site";
import { translate } from "@/lib/i18n/messages";
import { isLocale, defaultLocale } from "@/lib/i18n/locale";
import NewUploadRequestPage from "@/app/request/new/view";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return {
    title: createPageTitle(
      translate(isLocale(locale) ? locale : defaultLocale, "Request a file"),
    ),
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  return (
    <NewUploadRequestPage locale={isLocale(locale) ? locale : defaultLocale} />
  );
}
export const dynamic = "error";
