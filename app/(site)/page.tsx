import Hero from "../components/Hero";
import LatestRelease from "../components/LatestRelease";
import MobilePrototypeTests from "../components/MobilePrototypeTests";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Hero />
      <LatestRelease />
      <MobilePrototypeTests />
    </main>
  );
}