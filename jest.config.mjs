import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/**
 * @param {import("jest").Config} projectConfig
 * @returns {Promise<import("jest").Config>}
 */
async function createProjectConfig(projectConfig) {
  return createJestConfig(projectConfig)();
}

/** @returns {Promise<import("jest").Config>} */
const config = async () => {
  const [appConfig, serverConfig] = await Promise.all([
    createProjectConfig({
      displayName: "app",
      modulePathIgnorePatterns: ["<rootDir>/.next/"],
      roots: ["<rootDir>/src"],
      testEnvironment: "jsdom",
      testMatch: [
        "**/src/app/**/*.test.ts",
        "**/src/app/**/*.test.tsx",
        "**/src/components/**/*.test.ts",
        "**/src/components/**/*.test.tsx",
        "**/src/config/**/*.test.ts",
        "**/src/config/**/*.test.tsx",
        "**/src/lib/**/*.test.ts",
        "**/src/lib/**/*.test.tsx",
      ],
    }),
    createProjectConfig({
      displayName: "server",
      modulePathIgnorePatterns: ["<rootDir>/.next/"],
      roots: ["<rootDir>/src"],
      testEnvironment: "node",
      testMatch: ["**/src/server/**/*.test.ts"],
    }),
  ]);

  return {
    projects: [appConfig, serverConfig],
  };
};

export default config;
