// Last-resort error shell: renders when even the root layout fails.
// Plain HTML only — no app components, since they may be broken.

"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0b0e13",
          color: "#e8ecf3",
          fontFamily: "system-ui, sans-serif",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <h1>Something went wrong</h1>
        <p>Reload the page. If the problem persists, try again later.</p>
        <button
          onClick={reset}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#4f8cff",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
