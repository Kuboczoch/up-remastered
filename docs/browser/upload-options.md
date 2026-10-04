# Browser upload options

## Text encoding

Text uploads use UTF-8 on typed and clipboard paths. The Text encoding control
remains disabled at UTF-8; selectable encodings are not part of this stack.
Clipboard files retain their original bytes. Closing options or switching
File/Text preserves the text draft; file mode hides the encoding control.

Expiry, download limits and key protection remain disabled until their
respective implementation is integrated.

## Opt-in upload history

Save history is off unless this browser previously recorded explicit consent.
Before consent, upload records are not read, restored, migrated, pruned or saved.
Enabling persists consent and then restores local records and migrates older
session records. Disabling revokes consent immediately and removes records from
both local and session storage in this tab and legacy session records in other
open same-origin tabs; server uploads are unchanged.
Re-enabling starts with an empty history after a successful disable.

Clear history removes browser records from both stores but keeps consent enabled;
an explicit local-storage clear notification also erases each receiving tab's
legacy session records, even if persistent records were already empty.
Subsequent successful uploads can be recorded. Individual Remove actions forget a
browser record; Delete file is a separate, explicitly labelled server action.
Consent and records synchronize through local-storage events across same-origin
tabs. An upload finishing after revocation checks current persisted consent and
must not save even if the storage event has not arrived. Session storage belongs
to its tab; inactive legacy records in another tab are never migrated without
consent. Browser storage failures fail closed when enabling, and unsuccessful
clearing is reported rather than claimed successful. Clear site data to remove
records from a blocked browser or shared device. Consent success and storage
failure/clearing warnings appear beside Save history inside the options panel
and its mobile dialog live region; history-list actions have separate feedback.

History stores an allowlisted set of metadata and deletion access tokens. URL
fragments are stripped on save/read/migration and extra properties are discarded:
no fragment encryption keys are retained. If protected uploads are integrated,
history cannot reconstruct their full unlocking links or recover their keys.
Keep the original full link separately. Fragment scrubbing starts only after
consent; opting out does not inspect or rewrite pre-existing legacy records.
