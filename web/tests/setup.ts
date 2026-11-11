import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { apiLayer } from "@/lib/request-layer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/en",
  // DECISIONS 58: a test can render a demo role with asRole() (tests/helpers.ts); the default is no query.
  useSearchParams: () => new URLSearchParams((globalThis as { __search?: string }).__search ?? ""),
}));

afterEach(() => {
  cleanup();
  apiLayer.clear(); // FX3: no kept API answer crosses from one test to the next
  (globalThis as { __search?: string }).__search = "";
});
