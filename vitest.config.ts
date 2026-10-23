import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      BASE_URL: "http://localhost:3000",
      LINKEDIN_CLIENT_ID: "test-client-id",
      LINKEDIN_CLIENT_SECRET: "test-client-secret",
      SESSION_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      DATA_DIR: "data-test",
    },
  },
});
