// Home page: the interactive downloader.
// No `await searchParams` here, so this route stays static. The shareable
// query string is applied by the client once, after hydration.

import { HomeDownloader } from "@/components/home/downloader";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <HomeDownloader />
    </div>
  );
}
