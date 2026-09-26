# Upstream Feature and Issue Parity

## Scope and authority

This matrix compares `up-remastered` against current `Starchasers/up` `develop` at commit [`8f34ca73626144a67cfbaaccad88d9546ca761cf`](https://github.com/Starchasers/up/commit/8f34ca73626144a67cfbaaccad88d9546ca761cf). The initial remastered baseline is [`8a1c546d2068d6f92711e4c6da171887f8c90342`](https://github.com/Kuboczoch/up-remastered/commit/8a1c546d2068d6f92711e4c6da171887f8c90342).

Current source behavior is authoritative. Historical authentication, user administration, password recovery, mail, and profile work is excluded because merged upstream [PR #248](https://github.com/Starchasers/up/pull/248) removed it. Safer remastered behavior—collision retries, atomic storage, read-time expiration, aggregate quota, sanitized errors, attachment downloads, and SQLite—is retained unless it prevents a current upstream capability.

Status meanings:

- **Implemented**: code and automated coverage exist at the remastered baseline.
- **Partial**: useful implementation exists but current upstream behavior remains uncovered.
- **Missing/planned**: an issue owns implementation and coverage.
- **Superseded/not applicable**: absent from current upstream source or tied to removed Kotlin/JVM architecture.

## Current capability matrix

| Upstream capability | Upstream evidence | Remastered state | Implementation / coverage |
| --- | --- | --- | --- |
| Anonymous multipart upload | `POST /api/upload` | Partial | Existing streaming upload in `src/app/api/upload/route.ts`; compatibility fields and access token tracked by [#60](https://github.com/Kuboczoch/up-remastered/issues/60). |
| MIME, filename, size, expiry persistence | `FileService.kt`, `UploadRepository.kt` | Partial | `src/server/uploads/create-upload.ts`, SQLite tests; upstream edge cases tracked by #60. |
| Public download | `GET /u/{key}` | Partial | `GET/HEAD /{id}` exists in `src/app/[id]/route.ts`; upstream alias tracked by #61. |
| Byte ranges | `RequestRangeParser.kt` | Missing | Tracked by #61; current downloader streams full content only. |
| Public file details | `GET /api/u/{key}/details` | Missing | Tracked by #61. |
| Access-token verification | `POST /api/u/{key}/verify` | Missing | Tracked by #60 and #61. |
| Token-protected deletion | `DELETE /api/u/{key}` | Missing | Tracked by #60 and #61. |
| Public upload configuration | `GET /api/configuration` | Missing | Tracked by #62. |
| Admin configuration | `GET/PATCH /api/admin/config` | Superseded/dead upstream path | Current upstream removed authentication in PR #248, leaving these role-guarded routes unreachable. No insecure replacement will be invented; disposition is documented in #62. |
| ShareX configuration | `GET /sharex` | Missing | Tracked by #62. |
| Shell upload helper | `GET /sh` | Missing | Tracked by #62. |
| Upload chooser and drag/drop UI | `next-app` upload containers | Missing | Homepage is still a placeholder; tracked by #63. |
| Clipboard file/text upload | `FileUploadProvider.tsx` | Missing | Tracked by #63, including macOS and mobile open issues. |
| Upload progress and result UI | upload box components | Missing | Tracked by #63: progress/title, URL, copy/open, QR, expiry, reset. |
| Expiry enforcement on read | `AutomaticCleanupService.kt` plus current read behavior | Implemented safer | `create-download-response.ts` rejects expired rows at read time; unit/API coverage exists. |
| Expired-file cleanup | `AutomaticCleanupService.kt` | Missing | Future-only target documentation confirmed the gap; tracked by [#66](https://github.com/Kuboczoch/up-remastered/issues/66). |
| Local bytes plus relational metadata | repository/migration code | Implemented with intentional substitution | Filesystem bytes plus SQLite metadata, Drizzle migrations, quota/collision safety. PostgreSQL/Kotlin are intentionally replaced. |
| Anonymous access model | security configuration | Partial | Upload/download are anonymous; per-file mutation authority arrives in #60/#61. User/JWT/password flows were removed upstream by PR #248 and are excluded. |
| Runtime/deployment configuration | `application.yaml`, Dockerfile | Implemented with remastered names | Central Zod environment validation, Compose persistence, non-root standalone Docker, documentation and CI coverage. |
| Error handling | `ExceptionHandler.kt` | Partial/safer | Structured sanitized upload errors and safe 404s exist; complete route/error parity tracked by #60, #61, and #64. |

## Dependency-ordered delivery

1. [#60](https://github.com/Kuboczoch/up-remastered/issues/60): upload compatibility and access-token persistence.
2. [#61](https://github.com/Kuboczoch/up-remastered/issues/61): download alias, ranges, details, verify, and delete routes.
3. [#62](https://github.com/Kuboczoch/up-remastered/issues/62): public configuration, ShareX, and shell helper.
4. [#63](https://github.com/Kuboczoch/up-remastered/issues/63): complete responsive browser upload experience.
5. [#64](https://github.com/Kuboczoch/up-remastered/issues/64): applicable open upstream feature/security issues.
6. [#66](https://github.com/Kuboczoch/up-remastered/issues/66): expired-upload cleanup lifecycle.
7. [#65](https://github.com/Kuboczoch/up-remastered/issues/65): final matrix closure and complete clean verification.

## All upstream issues

Every GitHub issue is listed once. Pull requests are evidence, not separate product requirements. Open issue applicability is explicit; closed historical issues are either mapped to retained behavior, target work, supersession, or architecture disposition.

| Upstream issue | State | Disposition |
| --- | --- | --- |
| [#1](https://github.com/Starchasers/up/issues/1) Background image | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#2](https://github.com/Starchasers/up/issues/2) Basic input box | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#3](https://github.com/Starchasers/up/issues/3) Meta tags | closed | Implemented in remastered with automated coverage |
| [#12](https://github.com/Starchasers/up/issues/12) Upload file to the backend | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#13](https://github.com/Starchasers/up/issues/13) Loading bar | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#14](https://github.com/Starchasers/up/issues/14) After upload menu | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#17](https://github.com/Starchasers/up/issues/17) Fix cross origin only for development | closed | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#18](https://github.com/Starchasers/up/issues/18) Axios problem, 413 is returning "Error: Network Error" | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#20](https://github.com/Starchasers/up/issues/20) Paste on a website to upload | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#21](https://github.com/Starchasers/up/issues/21) Error handling | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#24](https://github.com/Starchasers/up/issues/24) Text upload from clipboard | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#25](https://github.com/Starchasers/up/issues/25) Make links easier to copy | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#26](https://github.com/Starchasers/up/issues/26) Uploaded file details | closed | Planned in target [#61](https://github.com/Kuboczoch/up-remastered/issues/61) |
| [#27](https://github.com/Starchasers/up/issues/27) Introduce react-redux to the project | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#32](https://github.com/Starchasers/up/issues/32) Logo and favicon | open | Implemented in remastered with automated coverage |
| [#33](https://github.com/Starchasers/up/issues/33) 404 Page | closed | Implemented in remastered with automated coverage |
| [#38](https://github.com/Starchasers/up/issues/38) Usage info of our website | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#40](https://github.com/Starchasers/up/issues/40) Display file details from response | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#41](https://github.com/Starchasers/up/issues/41) Create an endpoint to check if file is too big | closed | Planned in target [#62](https://github.com/Kuboczoch/up-remastered/issues/62) |
| [#42](https://github.com/Starchasers/up/issues/42) Send a request to an endpoint to check if a file is too big | closed | Planned in target [#62](https://github.com/Kuboczoch/up-remastered/issues/62) |
| [#45](https://github.com/Starchasers/up/issues/45) Upload request link | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#46](https://github.com/Starchasers/up/issues/46) User login form | closed | Superseded: behavior is absent from current upstream `develop` |
| [#47](https://github.com/Starchasers/up/issues/47) Initial admin user creation | closed | Superseded: behavior is absent from current upstream `develop` |
| [#48](https://github.com/Starchasers/up/issues/48) Init react-admin | closed | Superseded: behavior is absent from current upstream `develop` |
| [#49](https://github.com/Starchasers/up/issues/49) Implement react-admin | closed | Superseded: behavior is absent from current upstream `develop` |
| [#50](https://github.com/Starchasers/up/issues/50) Create user model to map users | closed | Superseded: behavior is absent from current upstream `develop` |
| [#51](https://github.com/Starchasers/up/issues/51) Register user via admin panel | closed | Superseded: behavior is absent from current upstream `develop` |
| [#52](https://github.com/Starchasers/up/issues/52) Mailgun integration | closed | Superseded: behavior is absent from current upstream `develop` |
| [#53](https://github.com/Starchasers/up/issues/53) backend security setup | closed | Superseded: behavior is absent from current upstream `develop` |
| [#54](https://github.com/Starchasers/up/issues/54) User management endpoints | closed | Superseded: behavior is absent from current upstream `develop` |
| [#55](https://github.com/Starchasers/up/issues/55) JWT token flow | closed | Superseded: behavior is absent from current upstream `develop` |
| [#56](https://github.com/Starchasers/up/issues/56) User profile page | closed | Superseded: behavior is absent from current upstream `develop` |
| [#57](https://github.com/Starchasers/up/issues/57) Forgot password button and form | closed | Superseded: behavior is absent from current upstream `develop` |
| [#58](https://github.com/Starchasers/up/issues/58) Login button and page | closed | Superseded: behavior is absent from current upstream `develop` |
| [#59](https://github.com/Starchasers/up/issues/59) Forgot password functionality | closed | Superseded: behavior is absent from current upstream `develop` |
| [#60](https://github.com/Starchasers/up/issues/60) Display maximum allowed upload size when 413 received | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#64](https://github.com/Starchasers/up/issues/64) Upload history for anonymous users | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#65](https://github.com/Starchasers/up/issues/65) Auth user upload history | closed | Superseded: behavior is absent from current upstream `develop` |
| [#66](https://github.com/Starchasers/up/issues/66) Change status code to user friendly message | closed | Implemented in remastered with automated coverage |
| [#68](https://github.com/Starchasers/up/issues/68) Handle errors right after file input | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#71](https://github.com/Starchasers/up/issues/71) drag and drop folder | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#72](https://github.com/Starchasers/up/issues/72) multi-select window when selecting file to upload | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#73](https://github.com/Starchasers/up/issues/73) Link copy unreliable and annoying | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#74](https://github.com/Starchasers/up/issues/74) "Open link" button | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#75](https://github.com/Starchasers/up/issues/75) file names truncated on space character | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#77](https://github.com/Starchasers/up/issues/77) database connection broken when handling multiple upload requests at once | closed | Implemented in remastered with automated coverage |
| [#78](https://github.com/Starchasers/up/issues/78) Application works offline | closed | Superseded: behavior is absent from current upstream `develop` |
| [#79](https://github.com/Starchasers/up/issues/79) Favicon doesn't load when viewing iniline content | closed | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#82](https://github.com/Starchasers/up/issues/82) info box hard to notice | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#83](https://github.com/Starchasers/up/issues/83) Up/logo square looks like a button | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#84](https://github.com/Starchasers/up/issues/84) Wrong url bar color on mobile browsers | closed | Implemented in remastered with automated coverage |
| [#88](https://github.com/Starchasers/up/issues/88) Robots.txt | closed | Implemented in remastered with automated coverage |
| [#89](https://github.com/Starchasers/up/issues/89) Improve performance of builds in jenkins | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#92](https://github.com/Starchasers/up/issues/92) Missing default encoding | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#93](https://github.com/Starchasers/up/issues/93) Google analytics | closed | Superseded: behavior is absent from current upstream `develop` |
| [#94](https://github.com/Starchasers/up/issues/94) Allow to rewind video in a browser | closed | Planned in target [#61](https://github.com/Kuboczoch/up-remastered/issues/61) |
| [#95](https://github.com/Starchasers/up/issues/95) Redirect 404 to error page | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#96](https://github.com/Starchasers/up/issues/96) Display error page based on request parameters | closed | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#97](https://github.com/Starchasers/up/issues/97) Open Graph width and height | closed | Superseded: behavior is absent from current upstream `develop` |
| [#100](https://github.com/Starchasers/up/issues/100) ctrl + c, isn't working correctly | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#101](https://github.com/Starchasers/up/issues/101) Update names in manifest | closed | Implemented in remastered with automated coverage |
| [#102](https://github.com/Starchasers/up/issues/102) Setup a wiki | closed | Implemented in remastered with automated coverage |
| [#107](https://github.com/Starchasers/up/issues/107) Add backend .env file | closed | Implemented in remastered with automated coverage |
| [#109](https://github.com/Starchasers/up/issues/109) Remove sharp module | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#110](https://github.com/Starchasers/up/issues/110) Server crashes when file name is not provided | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#111](https://github.com/Starchasers/up/issues/111) Double click on link to copy | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#120](https://github.com/Starchasers/up/issues/120) README.md | open | Implemented in remastered with automated coverage |
| [#121](https://github.com/Starchasers/up/issues/121) Icon is missing | closed | Implemented in remastered with automated coverage |
| [#123](https://github.com/Starchasers/up/issues/123) onDragEnter visible dropzone | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#124](https://github.com/Starchasers/up/issues/124) No internet connection popup | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#126](https://github.com/Starchasers/up/issues/126) Fix generated documentation | closed | Implemented in remastered with automated coverage |
| [#133](https://github.com/Starchasers/up/issues/133) Try standalone npm in CI | closed | Implemented in remastered with automated coverage |
| [#134](https://github.com/Starchasers/up/issues/134) Configuration endpoint | closed | Planned in target [#62](https://github.com/Kuboczoch/up-remastered/issues/62) |
| [#135](https://github.com/Starchasers/up/issues/135) User-specific limits | closed | Superseded: behavior is absent from current upstream `develop` |
| [#136](https://github.com/Starchasers/up/issues/136) Host bash script for simple uploads | closed | Planned in target [#62](https://github.com/Kuboczoch/up-remastered/issues/62) |
| [#141](https://github.com/Starchasers/up/issues/141) Screen recording | closed | Superseded: behavior is absent from current upstream `develop` |
| [#142](https://github.com/Starchasers/up/issues/142) Camera recording | closed | Superseded: behavior is absent from current upstream `develop` |
| [#145](https://github.com/Starchasers/up/issues/145) Change configuration endpoint | closed | Planned in target [#62](https://github.com/Kuboczoch/up-remastered/issues/62) |
| [#146](https://github.com/Starchasers/up/issues/146) Create APIClient | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#148](https://github.com/Starchasers/up/issues/148) Format config error message to convert upload size unit from bytes | open | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#149](https://github.com/Starchasers/up/issues/149) Add typescript to the APIClient | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#150](https://github.com/Starchasers/up/issues/150) Percentage in title | open | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#151](https://github.com/Starchasers/up/issues/151) Enable text compression | open | Implemented in remastered with automated coverage |
| [#153](https://github.com/Starchasers/up/issues/153) Upload text from clipboard on mobile | open | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#154](https://github.com/Starchasers/up/issues/154) List of encodings | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#156](https://github.com/Starchasers/up/issues/156) Specify content type from file | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#157](https://github.com/Starchasers/up/issues/157) Specify file encoding | closed | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#158](https://github.com/Starchasers/up/issues/158) More clear responses | closed | Implemented in remastered with automated coverage |
| [#159](https://github.com/Starchasers/up/issues/159) Make `username` field updatable | closed | Superseded: behavior is absent from current upstream `develop` |
| [#163](https://github.com/Starchasers/up/issues/163) Refactor data validation | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#164](https://github.com/Starchasers/up/issues/164) Add avatar to user profile | closed | Superseded: behavior is absent from current upstream `develop` |
| [#165](https://github.com/Starchasers/up/issues/165) Refactor user update | closed | Superseded: behavior is absent from current upstream `develop` |
| [#166](https://github.com/Starchasers/up/issues/166) Refactor user configuration | closed | Superseded: behavior is absent from current upstream `develop` |
| [#167](https://github.com/Starchasers/up/issues/167) Add more detailed info about user | closed | Superseded: behavior is absent from current upstream `develop` |
| [#170](https://github.com/Starchasers/up/issues/170) Redirect after creating an account | closed | Superseded: behavior is absent from current upstream `develop` |
| [#171](https://github.com/Starchasers/up/issues/171) Unable to delete user in admin panel | closed | Superseded: behavior is absent from current upstream `develop` |
| [#172](https://github.com/Starchasers/up/issues/172) Add `disabled` field to user modal | closed | Superseded: behavior is absent from current upstream `develop` |
| [#173](https://github.com/Starchasers/up/issues/173) Too long username causes status 500 | closed | Superseded: behavior is absent from current upstream `develop` |
| [#175](https://github.com/Starchasers/up/issues/175) When someone enters a /sharex redirect it to a github wiki | closed | Superseded: behavior is absent from current upstream `develop` |
| [#178](https://github.com/Starchasers/up/issues/178) Time to delete parameter | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#179](https://github.com/Starchasers/up/issues/179) Generate QR Code with URL | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#183](https://github.com/Starchasers/up/issues/183) Increase max Content-Length size | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#191](https://github.com/Starchasers/up/issues/191) CI should fail when curl receives error status | open | Implemented in remastered with automated coverage |
| [#194](https://github.com/Starchasers/up/issues/194) Exception when uploading some text files | closed | Planned in target [#60](https://github.com/Kuboczoch/up-remastered/issues/60) |
| [#201](https://github.com/Starchasers/up/issues/201) Failed login attempts should return 401 | closed | Superseded: behavior is absent from current upstream `develop` |
| [#203](https://github.com/Starchasers/up/issues/203) mysqld.exe is still running after stopping bootRunDev | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#204](https://github.com/Starchasers/up/issues/204) Add user type to the login response | closed | Superseded: behavior is absent from current upstream `develop` |
| [#207](https://github.com/Starchasers/up/issues/207) Inline files sandox | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#210](https://github.com/Starchasers/up/issues/210) Possible 413 when file size limit from application.properties is smaller than limit from dynamic configuration | open | Implemented in remastered with automated coverage |
| [#211](https://github.com/Starchasers/up/issues/211) Get rid fo LocalDateTime | open | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#212](https://github.com/Starchasers/up/issues/212) Migrate to postgres | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#213](https://github.com/Starchasers/up/issues/213) Move step "Upload artifacts to CD" to it's own job | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#214](https://github.com/Starchasers/up/issues/214) Build spring-app with artifact from the next-app build job | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#215](https://github.com/Starchasers/up/issues/215) Add spring-app/database to .gitignore | open | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#216](https://github.com/Starchasers/up/issues/216) Endpoint /api/upload mistake in documentation | open | Implemented in remastered with automated coverage |
| [#217](https://github.com/Starchasers/up/issues/217) Add error response to the documentation | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#218](https://github.com/Starchasers/up/issues/218) Add README.md with required envs to the spring-app | open | Implemented in remastered with automated coverage |
| [#219](https://github.com/Starchasers/up/issues/219) Add support for .mov files | open | Planned/reviewed in target [#64](https://github.com/Kuboczoch/up-remastered/issues/64) |
| [#220](https://github.com/Starchasers/up/issues/220) Update kotlin to version 1.7 | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#221](https://github.com/Starchasers/up/issues/221) Update spring boot to version 3 | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#222](https://github.com/Starchasers/up/issues/222) migrate to springdoc-openapi | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#223](https://github.com/Starchasers/up/issues/223) migrate to kotlin-exposed | closed | Not applicable to the TypeScript rewrite or replaced by an intentional architecture choice |
| [#241](https://github.com/Starchasers/up/issues/241) build docker image in CI | closed | Implemented in remastered with automated coverage |
| [#244](https://github.com/Starchasers/up/issues/244) Paste into the website is not working on mac os | open | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |
| [#245](https://github.com/Starchasers/up/issues/245) Upload url is taking more than one line | closed | Planned in target [#63](https://github.com/Kuboczoch/up-remastered/issues/63) |

## Completion rule

Parity is not complete while any capability is Partial/Missing or any applicable issue points to an open target ticket. #65 owns the final evidence pass and must link each implemented row to code and automated coverage before closure.
