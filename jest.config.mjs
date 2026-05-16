import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import("jest").Config} */
const config = {
  testEnvironment: "node",
  testMatch: ["**/src/**/*.test.ts", "**/src/**/*.test.tsx"],
};

export default createJestConfig(config);
