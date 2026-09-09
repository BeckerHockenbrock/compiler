export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          padding: "2rem",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--card-bg)",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem", color: "var(--primary)" }}>
          Personal Progression App
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", lineHeight: "1.6" }}>
          Repository and technical architecture foundation established.
          Zero server-runtime static export, local-first namespaced persistence,
          versioned migrations, and deterministic domain calculations.
        </p>
        <div
          style={{
            fontSize: "0.875rem",
            padding: "0.75rem",
            borderRadius: "6px",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            color: "var(--foreground)",
          }}
        >
          Active Architecture: Static Client-First Export
        </div>
      </div>
    </main>
  );
}
