// Home page: hero summary + the interactive downloader.
// Search params provide deep-link state; the client keeps them in sync.

import { Downloader } from "@/components/home/downloader";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; subjects?: string }>;
}) {
  // Read once on the server so shared links render pre-filled.
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Downloader
        initialCourse={(params.course ?? "").toUpperCase()}
        initialSubjects={(params.subjects ?? "").toUpperCase()}
      />
    </div>
  );
}
