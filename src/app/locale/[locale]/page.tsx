import HomeContent from "@/components/home-content";
import { isLocale } from "@/i18n/locale";
export const dynamic = "force-static";
export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <HomeContent locale={isLocale(locale) ? locale : "en"} />;
}
