import { describe, expect, it } from "vitest";
import { parsePaperRef } from "@/server/gtu-urls";

describe("parsePaperRef", () => {
  it("normalises case, whitespace and a .pdf suffix", () => {
    expect(parsePaperRef(" be ", " 3160704 ", "w2024.pdf")).toEqual({
      course: "BE",
      subject: "3160704",
      session: "W2024",
    });
  });

  it("accepts the syllabus pseudo-session", () => {
    expect(parsePaperRef("BE", "3160704", "SYLLABUS")).toEqual({
      course: "BE",
      subject: "3160704",
      session: "SYLLABUS",
    });
  });

  it("rejects unknown courses", () => {
    expect(parsePaperRef("XX", "3160704", "W2024")).toBeNull();
  });

  it("rejects malformed subject codes", () => {
    expect(parsePaperRef("BE", "31", "W2024")).toBeNull();
    expect(parsePaperRef("BE", "../3160704", "W2024")).toBeNull();
    expect(parsePaperRef("BE", "3160704/../1", "W2024")).toBeNull();
    expect(parsePaperRef("BE", "", "W2024")).toBeNull();
  });

  it("rejects malformed sessions", () => {
    expect(parsePaperRef("BE", "3160704", "X2024")).toBeNull();
    expect(parsePaperRef("BE", "3160704", "W24")).toBeNull();
    expect(parsePaperRef("BE", "3160704", "../W2024")).toBeNull();
    expect(parsePaperRef("BE", "3160704", "")).toBeNull();
  });

  it("keeps diploma codes (10 chars) valid", () => {
    expect(parsePaperRef("di", "di03000031", "S2025")).toEqual({
      course: "DI",
      subject: "DI03000031",
      session: "S2025",
    });
  });
});
