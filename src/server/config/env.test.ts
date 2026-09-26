import { describe, expect, it } from "@jest/globals";

import { getServerEnv } from "@/env";

function environment(
  values: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}

describe("server environment", () => {
  it("applies documented defaults", () => {
    expect(getServerEnv(environment())).toMatchObject({
      DATABASE_URL: "file:/data/app.db",
      DATA_DIR: "/data",
      DEFAULT_EXPIRATION_HOURS: 24,
      MAX_EXPIRATION_HOURS: 24,
      MAX_STORED_BYTES: 10 * 1024 * 1024 * 1024,
      MAX_UPLOAD_SIZE: 1024 * 1024 * 1024,
      UP_PUBLIC_ORIGIN: "http://localhost:3000",
    });
  });

  it("coerces numeric settings and normalizes the public origin", () => {
    expect(
      getServerEnv(
        environment({
          DEFAULT_EXPIRATION_HOURS: "1.5",
          MAX_EXPIRATION_HOURS: "48",
          MAX_STORED_BYTES: "4096",
          MAX_UPLOAD_SIZE: "1024",
          UP_PUBLIC_ORIGIN: " https://up.example.test/path ",
        }),
      ),
    ).toMatchObject({
      DEFAULT_EXPIRATION_HOURS: 1.5,
      MAX_EXPIRATION_HOURS: 48,
      MAX_STORED_BYTES: 4096,
      MAX_UPLOAD_SIZE: 1024,
      UP_PUBLIC_ORIGIN: "https://up.example.test",
    });
  });

  it.each([
    ["DATABASE_URL", "postgres://example.test/up", "file: SQLite URL"],
    ["MAX_UPLOAD_SIZE", "1.5", "integer"],
    ["MAX_STORED_BYTES", "0", "positive"],
    ["UP_PUBLIC_ORIGIN", "file:///tmp/up", "absolute HTTP(S) URL"],
  ])("rejects invalid %s", (name, value, message) => {
    expect(() => getServerEnv(environment({ [name]: value }))).toThrow(message);
  });

  it("rejects a default expiration above the maximum", () => {
    expect(() =>
      getServerEnv(
        environment({
          DEFAULT_EXPIRATION_HOURS: "48",
          MAX_EXPIRATION_HOURS: "24",
        }),
      ),
    ).toThrow(
      "DEFAULT_EXPIRATION_HOURS must be less than or equal to MAX_EXPIRATION_HOURS.",
    );
  });
});
