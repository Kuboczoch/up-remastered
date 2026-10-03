# Protected downloads

Key protection is client-side encryption, not identity-based access control. Anyone
with the **complete** link can decrypt. Lost keys cannot be recovered by the
server. HTTPS (or localhost) and a browser supporting Web Crypto are required.
There is never a plaintext fallback.

## Sender and receiver

The sender creates a single-entry ZIP in memory, encrypts it with AES-256-GCM,
and uploads an opaque `encrypted.up` file as `application/octet-stream`, with
`encrypted=true`. The server requires that flag to be exactly `true`, the generic filename/MIME above, the supported version header, and a plausible bounded envelope size. It checks the actual streamed bytes on disk; it cannot authenticate ciphertext without the key. The original filename and MIME type are inside the encrypted
payload, not multipart fields. File size, traffic timing, expiration, and download
limits remain visible to the service.

The returned sharing link is `/decrypt/{id}#key={base64url-key}`. The key is
32 random bytes from `crypto.getRandomValues`, encoded as unpadded base64url.
It exists in memory and the share-link fragment only; it is never included in an
HTTP path, query, form, header, application log, or error message. Browser-local
history must strip the fragment before persisting protected records. Such records
cannot recover their complete link after reload; retain the original full link
separately. The browser address bar/history, clipboard, and anyone receiving the
full link are trust boundaries, not server-side key storage.

The receiver page does **not** fetch ciphertext on arrival. After validating the
fragment key, the user selects **Decrypt file**, which fetches `/{id}` once. This
counts as a download even if decryption fails. The request omits credentials,
uses no-referrer and no-store, and refuses redirects. Page metadata sets
`no-referrer` and discourages indexing. The key can also be entered locally into
a password input; no form sends it anywhere. Ciphertext retained in memory permits
wrong-key retries without spending another download. Network failures may require
another counted fetch. After successful authenticated decryption, **Save decrypted
file** downloads an object URL with the original name/type. Object URLs are revoked
on unmount; filenames are stripped of path separators and control characters.

Expired, removed, or download-exhausted files instruct the receiver to request a
new upload. Missing keys request the complete link. Wrong keys, damaged ciphertext,
unsupported versions, and malformed archives fail closed, without exposing partial
plaintext. Corrupt files require a new upload rather than bypassing authentication.

## Version 1 envelope

All integers below are unsigned. Outer bytes are:

| Offset | Bytes     | Meaning                                                       |
| ------ | --------- | ------------------------------------------------------------- |
| 0      | 6         | ASCII `UPENC` followed by version byte `01`                   |
| 6      | 12        | Fresh cryptographically random GCM IV                         |
| 18     | remainder | AES-GCM ciphertext followed by the 16-byte authentication tag |

The complete 18-byte header is authenticated as GCM additional authenticated data.
The key is fresh for every upload and is never part of the envelope. GCM uses a
128-bit tag. Web Crypto authenticates before the application parses plaintext.

Decrypted plaintext is:

1. Four-byte **big-endian** UTF-8 metadata length.
2. JSON `{"name":"original filename","type":"original MIME"}` in UTF-8, at most
   64 KiB. Decode strictly and validate both fields as strings.
3. A canonical ZIP archive with one uncompressed entry named `file`, containing
   the original bytes. ZIP fields are little-endian, version 2.0, no flags,
   extras, comments, data descriptors, or ZIP64; DOS timestamp is 1980-01-01.
   CRC32 is the standard ZIP polynomial `0xedb88320`. Local header is 30 bytes
   plus the four-byte name; central directory is 46 bytes plus that name; the
   end-of-central-directory record is 22 bytes. Sizes, CRC, central directory,
   entry count, and offsets are checked by reconstructing this canonical archive.

This is **not password-protected ZIP**. Ordinary ZIP tools cannot open the outer
encrypted envelope. Compatible receivers first authenticate/decrypt AES-GCM using
the fragment key and header, then parse metadata and extract the stored ZIP entry.
Only this canonical archive format is supported; arbitrary ZIPs are not accepted.

## Resource and cancellation boundaries

Protection supports original files up to **32 MiB**, with an envelope ceiling of
32 MiB + 64 KiB + 144 bytes. Downloads check declared Content-Length and enforce
the same ceiling while streaming, including servers that omit the length header.
The deployment's upload ceiling may be smaller; ciphertext overhead counts toward
that server limit. This is a whole-buffer implementation, not streaming encryption:
multiple plaintext/ciphertext copies may require roughly 256 MiB of browser memory
at the maximum size, depending on the browser. Memory allocation failure is an
error, never permission to upload plaintext. Larger files need a separately designed
chunked authenticated format, not an increased limit alone.

The client upload API accepts optional `expirationHours`, `maxDownloads`, and `protection` in its third options argument; policy fields remain alongside the opaque file and are never part of the key.

Encryption is preparation, not network upload progress. The sender labels preparation separately from XHR progress, and the receiver reports bytes received followed by authentication. Existing progress callbacks
report XHR byte progress only after encryption succeeds. Cancellation rejects
immediately and prevents sending after asynchronous file reads or crypto operations;
Web Crypto itself cannot be interrupted mid-operation. Receiver requests are aborted
on unmount. Pure-JavaScript ZIP/CRC work is bounded by the size limit and may briefly
occupy the browser thread.

## Security review and tests

The design uses the browser's standard AES-GCM implementation, fresh 256-bit keys
and 96-bit IVs, a fixed authenticated version header, authenticated metadata, strict
base64url decoding, and bounded archive parsing. Unit tests cover binary/Unicode
round trips, unique key/IV output, wrong and missing keys, header/ciphertext changes,
explicit size rejection, cancellation before send, multipart policy fields,
fragment-only key placement, independent Node/OpenSSL authentication of Web Crypto
output, ZIP layout, no landing fetch, and actionable unavailable-file errors.
This is implementation-level review and automated verification, **not an independent
cryptographic audit**.

Trust still includes the browser-delivered application code, TLS origin, browser
extensions, operating system, and sender/receiver devices. A malicious server can
serve modified JavaScript and steal keys despite encrypted stored bytes. This feature
does not protect against compromised endpoints, recipients sharing the complete link,
or analytics added later that capture full URLs. Do not add URL/key telemetry to
these routes. ZIP CRC is format validation; GCM authentication provides security.
