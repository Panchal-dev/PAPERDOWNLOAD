import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clientKey } from "@/server/rate-limit";

describe("clientKey", () => {
  it("prefers the proxy-set x-real-ip header", () => {
    const headers = new Headers({
      "x-real-ip": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9, 8.8.8.8",
    });
    expect(clientKey(headers, "pdf")).toBe("pdf:1.2.3.4");
  });

  it("uses the last x-forwarded-for entry (nearest trusted proxy)", () => {
    const headers = new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" });
    expect(clientKey(headers, "pdf")).toBe("pdf:8.8.8.8");
  });

  it("falls back to anon when no address is present", () => {
    expect(clientKey(new Headers(), "pdf")).toBe("pdf:anon");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit and then blocks", () => {
    const key = `limit:${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000)).toBe(true);
    expect(checkRateLimit(key, 2, 60_000)).toBe(true);
    expect(checkRateLimit(key, 2, 60_000)).toBe(false);
  });

  it("keeps separate keys isolated", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    expect(checkRateLimit(a, 1, 60_000)).toBe(true);
    expect(checkRateLimit(a, 1, 60_000)).toBe(false);
    expect(checkRateLimit(b, 1, 60_000)).toBe(true);
  });

  it("allows again once the window has passed", () => {
    const key = `window:${Math.random()}`;
    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
    expect(checkRateLimit(key, 1, 60_000)).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z"));
    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
  });
});
