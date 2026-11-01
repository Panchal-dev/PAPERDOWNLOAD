import { describe, expect, it } from "vitest";
import { orderSelection } from "@/lib/paper-engine";
import type { DownloadFileItem } from "@/types/download.types";

const single = (
  filename: string,
  course: string,
  subject: string,
  session: string,
): DownloadFileItem => ({
  filename,
  format: "single",
  course,
  subject,
  session,
});

describe("orderSelection", () => {
  it("expands merged rows, de-duplicates, and orders syllabus → oldest → newest", () => {
    const files: DownloadFileItem[] = [
      single("BE_3160704_W2024.pdf", "BE", "3160704", "W2024"),
      {
        filename: "BE_3160704_SYLLABUS.pdf",
        format: "syllabus",
        course: "BE",
        subject: "3160704",
        session: "SYLLABUS",
      },
      {
        filename: "BE_3160704_MERGE_ALL.pdf",
        format: "merge-all",
        course: "BE",
        subject: "3160704",
        sources: ["BE_3160704_S2024.pdf", "BE_3160704_W2023.pdf"],
      },
      single("DI_03000031_S2024.pdf", "DI", "03000031", "S2024"),
      {
        filename: "DI_03000031_MERGE_ALL.pdf",
        format: "merge-all",
        course: "DI",
        subject: "03000031",
        // Same source as the single above: must appear only once.
        sources: ["DI_03000031_S2024.pdf"],
      },
    ];

    // subjectsOrder is the list of subject codes, in on-screen order.
    const ordered = orderSelection(files, ["3160704", "03000031"]).map(
      (entry) => entry.name,
    );

    expect(ordered).toEqual([
      "BE_3160704_SYLLABUS.pdf",
      "BE_3160704_W2023.pdf",
      "BE_3160704_S2024.pdf",
      "BE_3160704_W2024.pdf",
      "DI_03000031_S2024.pdf",
    ]);
  });

  it("keeps subjects in the requested order and unknown subjects last", () => {
    const files: DownloadFileItem[] = [
      single("ZZ_1111_S2024.pdf", "ZZ", "1111", "S2024"),
      single("BE_3160704_S2024.pdf", "BE", "3160704", "S2024"),
      single("DI_03000031_S2024.pdf", "DI", "03000031", "S2024"),
    ];

    expect(
      orderSelection(files, ["03000031", "3160704"]).map((entry) => entry.name),
    ).toEqual([
      "DI_03000031_S2024.pdf",
      "BE_3160704_S2024.pdf",
      "ZZ_1111_S2024.pdf",
    ]);
  });
});
