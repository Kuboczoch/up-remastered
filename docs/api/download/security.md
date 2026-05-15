# Download Security

Future download authorization must check availability before sending bytes.

Rules:

- Tokens must be unguessable and generated with Node crypto.
- Password-protected files require password verification before download.
- Password hashes should use Argon2 or bcrypt.
- Expired files must return unavailable state.
- Files over download limit must return unavailable state.
- `Content-Disposition` must use sanitized filenames.
- Client input must never choose filesystem paths.
- Missing physical files should be handled gracefully.

Avoid leaking sensitive details. A bad token, expired file, missing file, or limit-reached file can use similar unavailable responses unless UI needs a specific state.
