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
        gap: 20,
        zIndex: 9999,
      }}
    >
      <video
        src="/dragon-test/video.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{ width: "100%", maxWidth: 400 }}
      />

      <a
        href="/dragon-test/redirect"
        style={{
          padding: "15px 25px",
          fontSize: 20,
          fontWeight: "bold",
          background: "#ffd700",
          color: "#000",
          borderRadius: 6,
          textDecoration: "none",
          fontFamily: "Verdana, sans-serif",
        }}
      >
        PLAY NOW
      </a>
    </main>
  );
}