# Static localized UI and deployment configuration

## Routing and rendering

Supported locales are **English (`en`)** and **Polish (`pl`)**. English source
messages are the fallback dictionary; `src/i18n/messages.ts` contains real Polish
translations, typed keys, and interpolation. Add keys there and use
`useTranslation().t(key, values)` in clients, `T` in server component trees,
or `translate(locale, key, values)` for server metadata. These are SSR-capable;
there is no post-hydration DOM replacement, browser language detection, or
application-text traversal. Unknown remote messages and machine codes are never
translated by guessing. File names, user text, links, tokens, keys, and API data
are not translation keys.

Public URLs stay `/`, `/request/new`, `/request/manage`, `/request/<token>`, and
`/decrypt/<id>`. `src/proxy.ts` negotiates before rendering and rewrites only
these UI routes to `/locale/{en|pl}/...`. Both static locales are emitted at
build time. Public `/` and `/request/new` remain `○`; internal localized
variants are `●` (`generateStaticParams`), not per-request localized rendering.
The manage shell is also static. Request-token DB pages, raw files, and API
handlers remain dynamic. `/[id]`, `/u/[key]`, `/api/**`, `/sharex`, `/sh`, and
assets never enter locale negotiation. Existing raw-route handler bytes are
unchanged.

There are separate root layouts at `app/(public)/layout.tsx` and
`app/locale/[locale]/layout.tsx`. This is intentional: a layout receives dynamic
parameters only at or above its own segment. Putting the provider in
`app/layout.tsx` would silently render English for Polish SSR. Original page
content is in `content.tsx` next to existing components; public and localized
pages share it. The locale-specific root writes `html[lang]`, initializes the
provider, and translates metadata, OpenGraph/Twitter descriptions and manifest.
Public canonical URLs are retained. Formatting uses the resolved locale and
UTC for stable server/client date rendering.

Unknown nested HTML GET/HEAD documents (for example `/missing/nested`) enter
locale negotiation without changing their public URL. APIs, raw aliases,
helpers, asset namespaces, dotted paths, and single-segment file IDs are
excluded. These misses use `app/global-not-found.tsx`, enabled with
`experimental.globalNotFound`, which provides its own complete document,
localized initial `html[lang]`, title/description, no-index metadata and branded
404 content. The proxy forwards the selected locale so query/cookie/header
precedence agrees with known UI routes. Non-HTML requests are not negotiated.
The internal locale catch-all remains scoped to the locale subtree; no universal
page catch-all is added. Rewriting public misses into that async root was tested
and returned streamed **200**, even with `notFound()` and a 404 rewrite status;
the complete global error document preserves an actual **404**. Regression
coverage includes English/Polish JavaScript-disabled SSR, Polish browser axe,
query persistence, missing API/asset security headers, and raw unavailable bytes.

## Selection, precedence and cache isolation

1. Supported explicit `?lang=en|pl` wins and persists in the `up-locale` cookie.
2. A supported `up-locale` cookie wins over `Accept-Language`.
3. Header members are parsed as RFC 9110 basic ranges and q-values, case
   insensitively. Regional tags map to a supported base, weights descending and
   original member order break ties. Specific matches beat wildcard matches;
   `q=0` base exclusions are not bypassed by a regional hint or wildcard.
4. Invalid members (including malformed or out-of-range q, extra parameters,
   invalid ranges, and excessive precision) are ignored. Unsupported explicit
   choices are ignored. When nothing supported is acceptable, **English is a
   deliberate safety fallback**, including `*;q=0`; we do not return 406.

Explicit internal locale URLs use their own locale. There is no automatic
locale cookie write for header negotiation; existing header hints are repeated
on navigation. A supported explicit choice persists across navigation and
reloads. Documents and RSC share the same provider/rewritten locale. Internal
static artifacts are keyed by locale. Public localized responses intentionally
use `Cache-Control: private, no-store` to protect against CDNs that disregard
Vary. `Content-Language` is set for localized responses.

### Known framework blocker (verified, not resolved)

Next 16.3.8's `dist/build/templates/app-page-runtime.js` replaces response Vary
via `res.setHeader('Vary', routeModule.getVaryHeader(...))` after both proxy and
`next.config` headers. Our `mergeVary` unit tests pass, but real HTML and dynamic
UI responses **drop `Accept-Language` and `Cookie`**, retaining only Next's RSC
and compression tokens. `private, no-store` prevents shared cache reuse, but
this does not satisfy the explicit Vary acceptance criterion. A proposed
package patch requires user approval; the attempted `pnpm patch next@16.3.8`
was blocked pending approval and was not executed. Do not claim complete Vary
acceptance based on the helper test. A framework fix must append/merge instead
of replacing, while retaining every framework token, then run real document
and RSC response tests. Changing ordinary Next response-header config alone
was tested and does not fix this version.

## Docker build-time configuration

Static content bakes `UP_PUBLIC_ORIGIN`, `MAX_UPLOAD_SIZE`,
`DEFAULT_EXPIRATION_HOURS`, and `MAX_EXPIRATION_HOURS`. Docker defines build
arguments in builder **and** runner stages; Compose propagates the same values
to all image builds and runtime environment. Rebuild/recreate the image when
these deployment values change. Setting only a runtime variable cannot change
already-generated metadata or SSR upload limits. The configuration schema and
runtime validation remain unchanged; runtime APIs still validate requests and
read deployment settings. Database/storage paths and quotas are runtime-only.

Example:

```sh
docker build --build-arg UP_PUBLIC_ORIGIN=https://files.example.org \
  --build-arg MAX_UPLOAD_SIZE=7340032 \
  --build-arg DEFAULT_EXPIRATION_HOURS=3 \
  --build-arg MAX_EXPIRATION_HOURS=12 -t up .
```

The locale registry/provider is baseline integration; upload and request form
workers must translate their own full validation, status, history, a11y and
button copy using this contract, without touching API codes or lifecycle
handlers. Final integrated coverage must be audited after their commits are
combined.
