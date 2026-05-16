import "server-only";

const DEFAULT_PUBLIC_ORIGIN = "http://localhost:3000";

export function getPublicOrigin(): string {
  const configuredOrigin = process.env.UP_PUBLIC_ORIGIN?.trim();

  if (!configuredOrigin) {
    return DEFAULT_PUBLIC_ORIGIN;
  }

  const url = new URL(configuredOrigin);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("UP_PUBLIC_ORIGIN must be an absolute HTTP(S) URL.");
  }

  return url.origin;
}

export function getPublicUrl(pathname: string): string {
  return new URL(pathname, `${getPublicOrigin()}/`).toString();
}
