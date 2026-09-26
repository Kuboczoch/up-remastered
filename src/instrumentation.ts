import { getServerEnv } from "@/env";

export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    getServerEnv();
  }
}
