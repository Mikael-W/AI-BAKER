export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div style={{ fontSize: "4rem" }}>🥐</div>
      <h1 style={{ fontSize: "2rem", color: "var(--croute)" }}>
        Théo, l'assistant de Chez Madeleine
      </h1>
      <p style={{ maxWidth: "32rem", lineHeight: 1.6 }}>
        Setup en place. L'interface de conversation arrive à l'étape 3.
      </p>
    </main>
  );
}
