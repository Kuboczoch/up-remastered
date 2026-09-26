import "server-only";

import { z } from "zod";

const GIB = 1024 * 1024 * 1024;

function optionalString(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const positiveInteger = (name: string, defaultValue: number) =>
  z.preprocess(
    optionalString,
    z.coerce
      .number({ error: `${name} must be a number.` })
      .int({ error: `${name} must be an integer.` })
      .positive({ error: `${name} must be positive.` })
      .safe({ error: `${name} must not exceed Number.MAX_SAFE_INTEGER.` })
      .default(defaultValue),
  );

const positiveNumber = (name: string, defaultValue: number) =>
  z.preprocess(
    optionalString,
    z.coerce
      .number({ error: `${name} must be a number.` })
      .positive({ error: `${name} must be positive.` })
      .default(defaultValue),
  );

const serverEnvSchema = z
  .object({
    DATABASE_URL: z.preprocess(
      optionalString,
      z
        .string()
        .default("file:/data/app.db")
        .refine((value) => {
          try {
            return new URL(value).protocol === "file:";
          } catch {
            return false;
          }
        }, "DATABASE_URL must be a file: SQLite URL."),
    ),
    DATA_DIR: z.preprocess(optionalString, z.string().default("/data")),
    DEFAULT_EXPIRATION_HOURS: positiveNumber("DEFAULT_EXPIRATION_HOURS", 24),
    MAX_EXPIRATION_HOURS: positiveNumber("MAX_EXPIRATION_HOURS", 24),
    MAX_STORED_BYTES: positiveInteger("MAX_STORED_BYTES", 10 * GIB),
    MAX_UPLOAD_SIZE: positiveInteger("MAX_UPLOAD_SIZE", GIB),
    UPLOAD_DIR: z.preprocess(optionalString, z.string().optional()),
    UP_PUBLIC_ORIGIN: z.preprocess(
      optionalString,
      z
        .string()
        .default("http://localhost:3000")
        .transform((value, context) => {
          try {
            const url = new URL(value);

            if (url.protocol === "http:" || url.protocol === "https:") {
              return url.origin;
            }
          } catch {
            // Report one stable configuration error below.
          }

          context.addIssue({
            code: "custom",
            message: "UP_PUBLIC_ORIGIN must be an absolute HTTP(S) URL.",
          });

          return z.NEVER;
        }),
    ),
  })
  .refine((env) => env.DEFAULT_EXPIRATION_HOURS <= env.MAX_EXPIRATION_HOURS, {
    message:
      "DEFAULT_EXPIRATION_HOURS must be less than or equal to MAX_EXPIRATION_HOURS.",
    path: ["DEFAULT_EXPIRATION_HOURS"],
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
  environment: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      `Invalid server environment:\n${result.error.issues
        .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }

  return result.data;
}
