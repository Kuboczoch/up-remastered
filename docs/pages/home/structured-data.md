# Homepage Structured Data

The public homepage emits one `application/ld+json` block with schema.org `WebSite` data.

Fields are intentionally limited to:

- `name`: `Up - Remastered`
- `description`: the same temporary file hosting description used by page metadata
- `url`: the validated `UP_PUBLIC_ORIGIN` root

Do not advertise ratings, pricing, accounts, search actions, an installable application, or other capabilities until the product ships them. JSON serialization escapes `<` so configured values cannot terminate the script element.

Unit tests validate the exact schema and safe serialization. Playwright parses the JSON-LD emitted by the production server.
