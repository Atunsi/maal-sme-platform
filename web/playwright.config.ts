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
  // E7: the whole suite runs at desktop width; the four viewports the SOP names run mobile.spec.ts.
  projects: [
    { name: "desktop", testIgnore: /mobile\.spec\.ts/ },
    { name: "phone-360", testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
    { name: "phone-390", testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "tablet-768", testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "laptop-1280", testMatch: /mobile\.spec\.ts/, use: { viewport: { width: 1280, height: 800 } } },
  ],
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
