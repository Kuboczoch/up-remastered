# Homepage Metadata

Root metadata is generated at request time from the validated `UP_PUBLIC_ORIGIN`. This keeps self-hosted canonical and social URLs tied to deployment configuration rather than a project-owned domain.

The homepage publishes:

- its exact `Up - Remastered` product title and description
- an absolute canonical URL
- Open Graph `website` title, description, site name, and URL
- a Twitter `summary` card with the same title and description

Social image fields stay absent until a repository-owned image ships. Unit tests cover the metadata model; Playwright verifies the browser title plus resolved canonical, Open Graph, and Twitter tags from the production server.
