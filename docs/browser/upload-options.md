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

## Clipboard, sharing and destructive actions

Copy URL and history Copy link share the client `copyLink` utility. Unsupported
Clipboard API or rejected permission renders accessible manual recovery with a
selectable complete URL; success is announced only after the clipboard resolves.
Protected current results retain their full fragment only in memory; history
cannot reconstruct it.

Native Share is feature-detected and invoked only by an explicit user gesture.
It sends only a public URL, a generic title and safe access explanation. Protected
results and history omit Share entirely: use a saved complete-link copy instead.
Cancellation is silent; other failures announce that Copy link remains available.

Delete file is available on the current result even with history disabled, using
the in-memory access token without adding persistence. Result and history deletion
require a native modal naming the file and broken-link consequences. Cancel starts
focused, Escape cancels before submission, focus returns to the trigger, and
in-flight duplicate requests are guarded. Failure keeps the live result/history.
Successful deletion reconciles by ID; matching current results become terminal
Deleted with no sharing/QR actions. Unrelated current results remain intact.
Remove from history and Clear history forget local records only, never server files.

Plain-text background paste populates an editable Text draft and never uploads
automatically; publishing requires Upload text. Inputs, textareas and editable
descendants are not intercepted. Deliberate clipboard-file paste remains supported.
UTF-8 stays fixed. Key protection availability is shown up front: HTTPS/localhost
and Web Crypto are required, otherwise its control is disabled. Fail-closed
submission validation remains authoritative; no plaintext downgrade is attempted.

Mobile secondary upload navigation, history controls and footer links have padded
44-pixel hit areas at 320/390px without moving the approved File/Text control.
History Copy link remains visible on mobile as the universal native-share fallback.

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
