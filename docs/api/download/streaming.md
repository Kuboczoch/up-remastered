# Download Streaming

Future download API routes must use the Node.js runtime:

```ts
export const runtime = "nodejs";
```

Do not use the Edge runtime for file downloads.

Support both future serving modes:

- Mode A: Next.js authorizes and streams files directly using Node.js streams.
- Mode B: Next.js authorizes, then delegates physical serving to Nginx with `X-Accel-Redirect`.

Direct streaming requirements:

- Do not read full files into memory.
- Set `Content-Type`.
- Set `Content-Length`.
- Set safe `Content-Disposition`.
- Use filesystem paths resolved from trusted metadata, never from client input.

`X-Accel-Redirect` is optional and should not be required for basic Docker deployments.
