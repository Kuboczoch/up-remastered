# Browser upload options

## Text encoding

Text uploads use UTF-8 on typed and clipboard paths. The Text encoding control
remains disabled at UTF-8; selectable encodings are not part of this stack.
Clipboard files retain their original bytes. Closing options or switching
File/Text preserves the text draft; file mode hides the encoding control.

Expiry offers 1, 3, 6, 12 and 24 hours (default 24) and applies to every upload
entry point. Server configuration and all legacy expiration fields are bounded
by the 24-hour maximum. Download limits and key protection remain disabled until
their respective implementation is integrated.

## Optional local upload history

Save history is a native checkbox exposed as a switch. It starts false on every
mount, including reloads and newly opened tabs, regardless of legacy consent.
The setting is held only in component memory: it is not persisted or synchronized.
With saving disabled, mount, upload completion, and storage events make zero
history-related storage calls. No consent lookup, migration, pruning write,
removal, or cross-tab synchronization runs. Legacy local/session data is untouched.

Enabling reads existing local history without changing storage, including when
JSON is malformed or entries are invalid. Session history is neither read nor
migrated. Turning saving off hides the list and preserves stored records without
any storage calls. Old entries are shown only while history is enabled.

A successful upload saves history only if saving remains enabled when it finishes.
Failed uploads and uploads finishing while disabled are not saved. Saved entries
retain the complete upload metadata, deletion access token, full share URL,
and any protected-link key; URL fragments are not scrubbed. History can therefore
retain sensitive unlocking information readable by same-origin site scripts in
browser localStorage: use this setting only on trusted devices. No cookies or
uploaded binary payloads are saved. This preservation does not enable the
currently disabled Key protect feature.

While enabled, Copy link, Download, Remove, Delete file, and Clear history remain
explicit list actions. While disabled, history is ignored completely.
Remove forgets the browser entry; Delete file also makes an explicit server
request. Clear history explicitly clears local records; it does not persist a
setting, migrate session data, or broadcast a clear notification to other tabs.
Storage errors must not break an otherwise successful upload.

The switch shows only its label, without helper text or routine enable/disable
feedback. Its track background and thumb transform use short CSS transitions;
keyboard and native checkbox behavior are retained. Reduced motion makes these
transitions effectively instant on both desktop and mobile.

Production browser regressions live in `src/app/history-review.spec.ts` (storage
contract, completion gating and manual actions) and `src/app/history-ui.spec.ts`
(fresh mounts, computed styles, actual frame-sampled motion in both directions,
reduced motion and keyboard activation at desktop/mobile widths).
