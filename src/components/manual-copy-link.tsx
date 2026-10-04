"use client";

import { useId } from "react";

/** Keep capability links in the current page only, never in a recovery URL. */
export function ManualCopyLink({ value }: { value: string }) {
  const instructionsId = useId();
  return (
    <div>
      <p id={instructionsId} role="status">
        Could not copy automatically. Select and copy the complete link below.
      </p>
      <input
        aria-label="Link to copy"
        aria-describedby={instructionsId}
        className="result-url"
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
      />
    </div>
  );
}
