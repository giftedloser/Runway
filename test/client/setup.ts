import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// The real app relies on a Vite `define` to inject __APP_VERSION__ at build
// time. vitest's project-level `define` doesn't cascade into jsdom's global
// scope reliably, so we set it directly on globalThis for the e2e project.
(globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = "test";

Object.defineProperty(window, "scrollTo", {
  value: vi.fn(),
  writable: true
});

afterEach(() => {
  cleanup();
});
