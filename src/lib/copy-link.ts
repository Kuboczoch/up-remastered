export async function copyLink(
  url: string,
  environment: { clipboard?: Pick<Clipboard, "writeText"> } = navigator,
): Promise<"copied" | "manual"> {
  try {
    if (!environment.clipboard?.writeText) return "manual";
    await environment.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}
