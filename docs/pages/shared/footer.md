# Shared site footer

The home page and both upload-request routes render the shared semantic `SiteFooter` component.

## Content

The footer presents the temporary-storage disclaimer, a link for creating an upload request, the project repository, the deployed application version, and the required artwork credit. The repository link opens GitHub in a new tab and announces that behavior in its accessible name.

## Layout and accessibility

- The footer boundary spans the available viewport width. Its inner content is constrained to the same 800 px maximum and responsive gutters as the main site shell.
- Footer content wraps compactly rather than causing horizontal scrolling on narrow viewports, with long version labels, or at 200% zoom.
- Subdued text retains WCAG AA contrast against the page background.
- Footer links expose a visible keyboard focus outline.

## Verification

Unit coverage verifies the footer landmark and primary destinations. Playwright verifies full-width desktop alignment, narrow-mobile reflow, long-version reflow, 200% zoom reflow, and browser-level accessibility.
