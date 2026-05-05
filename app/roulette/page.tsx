export default function Page() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        justifyContent: "center",
        overflowY: "auto",
        padding: "20px 0",
      }}
    >
      <a
        href="/roulette/redirect"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textDecoration: "none",
          cursor: "pointer",
          maxWidth: 420,
          width: "100%",
          padding: "0 16px",
        }}
      >
        {/* Hero */}
        <img
          src="/roulette/hero.png"
          alt=""
          style={{
            width: "100%",
            objectFit: "cover",
            borderRadius: 8,
          }}
        />

        {/* Headline */}
        <h1
          style={{
            color: "#fff",
            textAlign: "center",
            fontFamily: "Verdana, sans-serif",
            fontSize: 26,
          }}
        >
          MORE GOLD. NOW.
        </h1>

        {/* Step images */}
        <img src="/roulette/step1.png" alt="" style={imgStyle} />
        <img src="/roulette/step2.png" alt="" style={imgStyle} />
        <img src="/roulette/step3.png" alt="" style={imgStyle} />

        {/* CTA */}
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

const imgStyle = {
  width: "100%",
  objectFit: "cover",
  borderRadius: 8,
};