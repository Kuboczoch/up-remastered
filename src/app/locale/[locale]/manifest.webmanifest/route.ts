import { createManifest } from "@/config/manifest";
import { isLocale, supportedLocales } from "@/i18n/locale";
export const dynamic = "force-static";
export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  return Response.json(createManifest(locale), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Content-Language": locale,
    },
  });
}
