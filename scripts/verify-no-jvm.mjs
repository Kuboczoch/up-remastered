import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const forbiddenFiles = tracked.filter((path) =>
  /(?:^|\/)(?:gradlew(?:\.bat)?|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$|\.(?:class|gradle|jar|java|kt|kts)$/i.test(
    path,
  ),
);
const manifests = ["package.json", "pnpm-lock.yaml"].filter((path) =>
  tracked.includes(path),
);
const forbiddenDependencies = manifests.filter((path) =>
  /(?:org\.jetbrains\.kotlin|kotlin-stdlib|spring-boot|gradle-wrapper)/i.test(
    readFileSync(path, "utf8"),
  ),
);
const failures = [...forbiddenFiles, ...forbiddenDependencies];
if (failures.length > 0) {
  console.error(`JVM artifacts are forbidden: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      event: "no_jvm_artifacts_verified",
      tracked: tracked.length,
    }),
  );
}
