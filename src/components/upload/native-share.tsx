"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/provider";

const subscribe = () => () => {};
const supportsShare = () => typeof navigator.share === "function";
const serverSupportsShare = () => false;

function isPublicFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      (/^\/[0-9A-Z]{5}$/.test(url.pathname)
        ? !url.hash
        : /^\/decrypt\/[0-9A-Z]{5}$/.test(url.pathname) &&
          /^#key=[A-Za-z0-9_-]+$/.test(url.hash))
    );
  } catch {
    return false;
  }
}

export function NativeShare({ url }: { url: string }) {
  const { t } = useTranslation();
  const supported = useSyncExternalStore(
    subscribe,
    supportsShare,
    serverSupportsShare,
  );
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sharing = useRef(false);

  if (!supported || !isPublicFileUrl(url)) return null;

  async function share() {
    if (sharing.current) return;
    sharing.current = true;
    setPending(true);
    setFailed(false);
    try {
      // Call synchronously within the click gesture; never share owner metadata.
      await navigator.share({
        title: t("Shared file"),
        text: t("Download this file using the link."),
        url,
      });
    } catch (error) {
      if (
        !(
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        )
      ) {
        setFailed(true);
      }
    } finally {
      sharing.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="outline-button"
        style={{ minWidth: 44, minHeight: 44 }}
        type="button"
        disabled={pending}
        onClick={() => void share()}
      >
        {t("Share")}
      </button>
      {failed && (
        <span role="status">
          {t("Sharing did not complete. Use Copy link instead.")}
        </span>
      )}
    </>
  );
}
