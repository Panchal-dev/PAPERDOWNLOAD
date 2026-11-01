import { describe, expect, it } from "vitest";
import { downloadRequestSchema } from "@/schemas/download.schema";

describe("downloadRequestSchema", () => {
  it("trims and uppercases course + subject codes", () => {
    const parsed = downloadRequestSchema.safeParse({
      course: " be ",
      subjects: [" 3160704 ", "di03000031"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        course: "BE",
        subjects: ["3160704", "DI03000031"],
      });
    }
  });

  it("rejects an unknown course", () => {
    const parsed = downloadRequestSchema.safeParse({
      course: "XX",
      subjects: ["3160704"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty, duplicate and over-limit subject lists", () => {
    expect(
      downloadRequestSchema.safeParse({ course: "BE", subjects: [] }).success,
    ).toBe(false);

    expect(
      downloadRequestSchema.safeParse({
        course: "BE",
        subjects: ["3160704", "3160704"],
      }).success,
    ).toBe(false);

    expect(
      downloadRequestSchema.safeParse({
        course: "BE",
        subjects: ["1111", "2222", "3333", "4444", "5555", "6666"],
      }).success,
    ).toBe(false);
  });

  it("rejects malformed subject codes", () => {
    expect(
      downloadRequestSchema.safeParse({ course: "BE", subjects: ["../3160704"] })
        .success,
    ).toBe(false);
  });
});
