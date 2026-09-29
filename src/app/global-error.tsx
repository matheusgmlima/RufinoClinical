"use client";

// Last-resort boundary when the root layout itself fails. It replaces <html>, so it cannot rely
// on the app's CSS or fonts and uses inline styles only.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fbf7f4",
          color: "#1f1a1b",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 8px" }}>A loja está temporariamente indisponível</h1>
          <p style={{ color: "#6f615f", margin: "0 0 24px" }}>Tente de novo em alguns instantes.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#6e0b1e",
              color: "#fbf7f4",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
