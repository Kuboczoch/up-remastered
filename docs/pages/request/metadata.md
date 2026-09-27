# Request Page Metadata

Request pages use descriptive browser titles followed by the centralized product name:

- `/request/new`: `Request a file | Up - Remastered`
- `/request/[token]`: `Upload a requested file | Up - Remastered`

The homepage keeps the shorter `Up - Remastered` title. Upload progress temporarily replaces the current route title with `<percent>% · Up - Remastered` and restores the captured route title after completion, cancellation, or component unmount.
