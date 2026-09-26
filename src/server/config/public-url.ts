import "server-only";

import { getServerEnv } from "@/env";

export function getPublicOrigin(): string {
  return getServerEnv().UP_PUBLIC_ORIGIN;
}

export function getPublicUrl(pathname: string): string {
  return new URL(pathname, `${getPublicOrigin()}/`).toString();
}
