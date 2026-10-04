# Shared site footer

The home page and both upload-request routes render the shared semantic `SiteFooter` component.

## Content

The footer presents the temporary-storage disclaimer, download links for ShareX configuration and the shell helper, the project repository, the deployed application version, and the required artwork credit. The repository link opens GitHub in a new tab and announces that behavior in its accessible name.

The displayed `v<version>` value comes directly from the root `package.json` during the Next.js build. The standalone application and Docker image therefore carry the same package version without a separate UI constant.

## Layout and accessibility

- The footer boundary spans the available viewport width. Its inner content is constrained to the same 800 px maximum and responsive gutters as the main site shell.
- Footer content wraps compactly rather than causing horizontal scrolling on narrow viewports, with long version labels, or at 200% zoom.
- Subdued text retains WCAG AA contrast against the page background.
- Footer links expose a visible keyboard focus outline.
- At widths up to 760 px, each link has an actual minimum 44×44 CSS px box with horizontal padding, unchanged 11 px typography, and an 8 px flex gap. Wrapping keeps hit areas separate; no pseudo-element hit extensions overlap nearby links. Responsive gutters and bottom padding honor device safe-area insets.

## Verification

Unit coverage verifies the footer landmark, primary destinations, and that the rendered version matches `package.json`. Playwright verifies full-width desktop alignment, narrow-mobile reflow, long-version reflow, 200% zoom reflow, and browser-level accessibility.

`mobile-navigation.test.ts` checks CSS source contracts only, not rendered layout. `mobile-navigation.spec.ts` measures link bounding boxes, padded-edge pointer hit testing, separation, focus, typography, and overflow on the home and new-request pages at 320 and 390 px. Execution of those browser assertions requires a running app; source checks are not a substitute.
