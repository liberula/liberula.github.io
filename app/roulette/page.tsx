export default function Page() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        height: "100vh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        zIndex: 9999,
      }}
    >
      <a
        href="/roulette/redirect"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <img
          src="/roulette/image.png"
          style={{
            width: "100%",
            maxWidth: 400,
            objectFit: "cover",
            borderRadius: 8,
          }}
        />

        <h1 style={{ color: "#fff", textAlign: "center" }}>
          EVERYTHING ON THE LINE
        </h1>

        <div
          style={{
            padding: "15px 25px",
            fontSize: 20,
            fontWeight: "bold",
            background: "#ffd700",
            color: "#000",
            borderRadius: 6,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          PLAY NOW
        </div>
      </a>
    </main>
  );
}