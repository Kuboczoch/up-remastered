import { describe, expect, it } from "@jest/globals";

import nextConfig from "../../next.config";

describe("security headers", () => {
  it("applies baseline security headers to all app routes", async () => {
    const routes = await nextConfig.headers?.();

    expect(routes).toEqual([
      {
        source: "/:path*",
        headers: expect.arrayContaining([
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ]),
      },
    ]);
  });
});
