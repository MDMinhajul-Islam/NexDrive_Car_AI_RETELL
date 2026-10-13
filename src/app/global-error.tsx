"use client";

// Last-resort boundary: replaces the root layout, so it must render <html> and <body>
// and cannot rely on the app stylesheet.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>NexDrive is temporarily unavailable</h1>
          <p style={{ color: "#d4d4d4", lineHeight: 1.6 }}>Please try again in a moment.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "12px 24px",
              borderRadius: 8,
              border: 0,
              background: "#f5b942",
              color: "#1c1407",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
