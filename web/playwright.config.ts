// Needs the Python API running (web/README.md) and a finished `npm run build`.
// One worker: the API has a per-business rate limit, and these tests share one backend.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://127.0.0.1:3000", channel: "msedge" },
  webServer: [
    { command: "npx next start --port 3000", url: "http://127.0.0.1:3000/en", reuseExistingServer: false },
    // The 401 test: the same build started with a key the API will reject.
    {
      command: "npx next start --port 3001",
      url: "http://127.0.0.1:3001/en",
      reuseExistingServer: false,
      env: { MAAL_API_KEY: "deliberately-wrong-key" },
    },
  ],
});
