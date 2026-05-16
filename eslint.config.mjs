import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-plugin-prettier/recommended";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  globalIgnores([
    ".next/**",
    "github-copy/**",
    "next-env.d.ts",
    "node_modules/**",
    "out/**",
    "playwright-report/**",
    "public/**",
    "test-results/**",
  ]),
]);
