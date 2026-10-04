"use client";

export function ManualCopyLink({ url }: { url: string }) {
  return (
    <div className="manual-copy" role="status">
      <p>
        Automatic copy is unavailable. Select the complete link below and copy
        it manually.
      </p>
      <input
        aria-label="Complete link for manual copying"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}
