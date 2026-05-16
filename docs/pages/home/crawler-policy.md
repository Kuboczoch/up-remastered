# Homepage Crawler Policy

The app serves crawler metadata through Next.js App Router metadata routes:

```txt
/robots.txt
/sitemap.xml
```

Current policy:

- `/` is the only URL included in `sitemap.xml`.
- Crawlers are allowed to index the public homepage.
- `/api/`, `/download/`, and `/share/` are disallowed in `robots.txt`.

`UP_PUBLIC_ORIGIN` controls the absolute URLs emitted by crawler metadata. Set it to the public HTTP(S) origin of the deployment, for example:

```txt
UP_PUBLIC_ORIGIN=https://up.example.com
```

If `UP_PUBLIC_ORIGIN` is unset, crawler metadata uses `http://localhost:3000` for local development.

Future upload, share, and download URLs must not be added to `sitemap.xml` by default. Before any tokenized, expiring, password-protected, or private file URL is made indexable, define its crawler behavior in the matching scoped docs and confirm it cannot expose private content.
