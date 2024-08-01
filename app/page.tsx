import Image from "next/image";
import Hero from "./components/Hero";
import LatestRelease from "./components/LatestRelease";
import Experience from "./components/Experience";

export default function Home() {
  return (
    <main className="flex flex-col stretch">
      <Hero/>
      <LatestRelease/>
      <Experience/>
    </main>
  );
}
