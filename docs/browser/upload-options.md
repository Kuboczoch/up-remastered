# Browser upload options

## Text encoding

Text uploads use UTF-8 on typed and clipboard paths. The Text encoding control
remains disabled at UTF-8; selectable encodings are not part of this stack.
Clipboard files retain their original bytes. Closing options or switching
File/Text preserves the text draft; file mode hides the encoding control.

Expiry offers 1, 3, 6, 12 and 24 hours (default 24) and applies to every upload
entry point. Server configuration and all legacy expiration fields are bounded
by the 24-hour maximum. Download limit offers 1–10 downloads or Unlimited (default). A finite
limit counts each admitted GET, including ranges, retries and interrupted streams;
HEAD, invalid ranges and failures before admission do not count. See
`docs/api/download/requirements.md` for atomic admission and cleanup semantics.
Key protection is opt-in and encrypts original bytes with AES-256-GCM in the
browser. A complete fragment-key link opens the dedicated receiver; keys are
never saved in upload history. See `docs/pages/download/encryption.md`.

## Current upload deletion

Every successful current result offers secondary **Delete file**, even with Save
history off. It uses only that upload's in-memory access token, not its password
or fragment key, and never reads or writes history. The accessible confirmation
warns that existing sharing links break and deletion cannot be undone. Cancel
and Escape send no deletion request; Cancel receives initial focus and keyboard
focus remains inside the dialog while it is open. Pending confirmation cannot
be dismissed or submitted twice.

Only the management route's exact empty HTTP 200 confirms deletion. Authentication,
network, raw 404 and unexpected success responses retain the complete current
result and retry capability. Confirmation replaces the complete result with
**Deleted** and Upload another file; Copy, Open, Download and QR are removed.
The terminal state is page-local, not a new persisted-history status. With history
enabled, existing history behavior is unchanged by this independent current-result
lifecycle; persistent status reconciliation is a separate change.

## Opt-in upload history

Save history defaults off when the optional `up-remastered:history-enabled`
localStorage flag is absent. Mount restores only the exact `true` preference;
legacy consent is ignored. Enabling stores `true`; disabling removes the flag,
hides the list and leaves existing records unchanged. Routine toggles have no
helper copy or status feedback. Blocked preference storage shows an actionable
warning, but the setting continues to work for this page.

While disabled, history records are not read or saved. Enabled mounts and
enabling read local metadata without rewriting or migrating it. Tabs do not
synchronize live settings or records. Successful upload completion saves only
when history is currently enabled on that page; disabling during an upload
prevents its completion from being saved.

History stores allowlisted metadata, fragment-free share URLs and deletion
access tokens, never uploaded binary payloads or encryption keys. New saves
strip URL fragments and extra properties. Enabled reads scrub legacy local
records containing fragments or extra fields as a narrow security exception to
ordinary read-only access; disabled history does not inspect legacy records.
History cannot reconstruct protected unlocking links or recover keys: keep the
original complete link separately. Protected history entries disable Copy link
and omit Download actions rather than offering unusable unkeyed links.

Manual Clear history and Remove actions forget local records only while enabled.
Delete file is a separate server action. No automatic pruning or migration
occurs. Same-origin scripts can read saved metadata; clear site data on shared
devices, including dormant legacy session records.
