/** Copy only after feature detection; missing APIs and denied permission are recoverable. */
export async function copyLink(value: string): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText !== "function") return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
