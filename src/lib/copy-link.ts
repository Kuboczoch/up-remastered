export async function copyLink(
  url: string,
  environment: { clipboard?: Pick<Clipboard, "writeText"> } = navigator,
): Promise<"copied" | "manual"> {
  try {
    if (typeof environment.clipboard?.writeText !== "function") return "manual";
    await environment.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}
