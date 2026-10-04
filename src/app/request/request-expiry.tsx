"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { formatLocalDateTime, formatRelativeExpiry } from "@/lib/format";

const subscribe = () => () => {};

// Local time is calculated in the browser, not the server's timezone. The ISO
// fallback also gives non-hydrated pages an unambiguous exact expiration.
export function RequestExpiry({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <>
      {hydrated && <>{formatRelativeExpiry(expiresAt, now)} · </>}
      <time dateTime={expiresAt}>
        {hydrated ? formatLocalDateTime(expiresAt) : expiresAt}
      </time>
    </>
  );
}
