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
Key protection remains disabled until its implementation is integrated.

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

History stores complete upload metadata, share URLs and deletion access tokens,
not uploaded binary payloads. Manual Clear history and Remove actions forget
local records only while enabled. Delete file is a separate server action.
No automatic pruning, migration or clearing occurs. Same-origin scripts can
read saved metadata; clear site data on shared devices.
