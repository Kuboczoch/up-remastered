# Route Boundaries

The root App Router segment owns three baseline UI boundaries:

- `not-found.tsx` returns intentional 404 UI with a route home.
- `error.tsx` hides exception details and offers `reset()` recovery.
- `loading.tsx` announces suspended navigation through a polite status region.

Keep route-specific validation errors inside their route flows. Use these boundaries only for missing resources, unexpected rendering failures, and suspended navigation. Never render exception messages, digests, paths, uploaded names, or request data in public error UI.

Unit tests cover recovery, navigation, loading announcements, and accessibility. Playwright verifies the 404 status, public UI, return link, and browser-level accessibility.

Unknown browser page paths use this HTML boundary. Download-shaped paths (`/:id` and `/u/:key`) deliberately do not: an unknown, expired, or inaccessible upload returns the same plain-text `404 File unavailable.` response with no filename or storage details. This prevents a missing download from disclosing whether an identifier ever existed.
