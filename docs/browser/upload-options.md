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
Delete file is a separate server action. An empty HTTP 200 response confirms
deletion; the management API's structured `File not found.` HTTP 404 confirms
already-unavailable, not that this attempt deleted bytes. Raw/proxy 404s,
unexpected success responses, authentication errors, network errors and server
failures retain live actions and ownership metadata for retry.

Confirmed statuses update history and the currently displayed result by upload
ID. The result becomes Deleted or Unavailable with Upload another file, without
copy, open, download or QR actions. An unrelated result stays unchanged. While
history remains enabled, the retained local row saves `serverStatus` (`deleted`
or `unavailable`) and restores that explanation on reload; copy/download/re-delete
are disabled only for confirmed rows (protected-key restrictions still apply).
Remove and Clear history remain local forgetting actions, not server deletion
or Undo. Failed persistence is announced; the confirmed state remains visible
for the current page, with instructions to remove the local record before reload.
Deletion cannot restore already-deleted bytes. No automatic pruning or migration
occurs. Same-origin scripts can read saved metadata; clear site data on shared
devices, including dormant legacy session records.
