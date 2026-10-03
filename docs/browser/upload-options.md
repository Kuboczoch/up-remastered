# Browser upload options

## Text encoding

Text uploads use UTF-8 on typed and clipboard paths. The Text encoding control
remains disabled at UTF-8; selectable encodings are not part of this stack.
Clipboard files retain their original bytes. Closing options or switching
File/Text preserves the text draft; file mode hides the encoding control.

Expiry offers 1, 3, 6, 12 and 24 hours (default 24) and applies to every upload
entry point. Download limit offers 1–10 downloads or Unlimited (default). A finite
limit counts each admitted GET, including ranges, retries and interrupted streams;
HEAD, invalid ranges and failures before admission do not count. See
`docs/api/download/requirements.md` for atomic admission and cleanup semantics.
Key protection is opt-in and encrypts original bytes with AES-256-GCM in the
browser. A complete fragment-key link opens the dedicated receiver; keys are
never saved in upload history. See `docs/pages/download/encryption.md`.

## Opt-in upload history

Save history is off unless this browser previously recorded explicit consent.
Before consent, upload records are not read, restored, migrated, pruned or saved.
Enabling persists consent and then restores local records and migrates older
session records. Disabling revokes consent immediately and removes records from
both local and session storage in this tab; server uploads are unchanged.
Re-enabling starts with an empty history after a successful disable.

Clear history removes browser records from both stores but keeps consent enabled;
subsequent successful uploads can be recorded. Individual Remove actions forget a
browser record; Delete file is a separate, explicitly labelled server action.
Consent and records synchronize through local-storage events across same-origin
tabs. An upload finishing after revocation checks current persisted consent and
must not save even if the storage event has not arrived. Session storage belongs
to its tab; inactive legacy records in another tab are never migrated without
consent. Browser storage failures fail closed when enabling, and unsuccessful
clearing is reported rather than claimed successful. Clear site data to remove
records from a blocked browser or shared device.

History stores an allowlisted set of metadata and deletion access tokens. URL
fragments are stripped on save/read/migration and extra properties are discarded:
no fragment encryption keys are retained. For protected uploads,
history cannot reconstruct their full unlocking links or recover their keys.
Keep the original full link separately. Fragment scrubbing starts only after
consent; opting out does not inspect or rewrite pre-existing legacy records.
