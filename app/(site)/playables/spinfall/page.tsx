import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spinfall, Playable Ad Prototype | Liberula",
  description: "Play Spinfall, a short dark fantasy combat prototype built around a systems-driven combat wheel.",
  alternates: { canonical: "/playables/spinfall/" },
  openGraph: {
    title: "Spinfall, Playable Ad Prototype | Liberula",
    description: "Play Spinfall, a short dark fantasy combat prototype built around a systems-driven combat wheel.",
    type: "website",
    url: "/playables/spinfall/",
    images: ["/mobile-store/spinfall/hero.png"],
  },
};

export default function SpinfallPlayablePage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/playables/" className="text-sm font-bold text-[#f6c400] underline underline-offset-4">← Back to all playables</Link>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(300px,430px)_1fr] lg:items-start">
          <section>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-[#f6c400]">Playable Ad Prototype</p>
            <h1 className="text-5xl font-black italic leading-none sm:text-7xl">Spinfall</h1>
            <p className="mt-6 text-lg leading-relaxed text-neutral-300">A short dark fantasy combat experience built around a wheel that controls attack, healing, defense and survival.</p>
            <p className="mt-4 text-neutral-300">Built with JavaScript and Phaser, and focused on compact systems-driven gameplay.</p>
            <div className="mt-7 flex flex-wrap gap-2" aria-label="Technologies">
              {["Phaser", "JavaScript", "Web Build", "Gameplay Systems"].map((tag) => <span key={tag} className="border border-neutral-700 px-3 py-2 text-sm text-neutral-200">{tag}</span>)}
            </div>
            <div className="mt-8 border-l-4 border-[#f6c400] bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-300">
              <p>This is a portfolio prototype and has not been validated for a specific advertising network.</p>
              <p className="mt-3">The portfolio build does not redirect to an app store.</p>
            </div>
            <a href="mailto:gaba@liberula.com" className="mt-7 inline-block text-sm font-bold uppercase tracking-wide text-[#f6c400] underline underline-offset-4">Contact Liberula</a>
          </section>
          <section className="w-full" aria-label="Spinfall playable">
            <div className="overflow-hidden border border-neutral-700 bg-black shadow-2xl shadow-black/50">
              <iframe title="Spinfall playable ad prototype" src="/playables/spinfall/runtime/index.html" className="block aspect-[16/10] w-full border-0" allow="fullscreen" />
            </div>
            <p className="mt-3 text-center text-xs text-neutral-500">The playable loads from the local web build included in this portfolio.</p>
          </section>
        </div>
        <section className="mt-20 border-t border-neutral-800 pt-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-500">More playable prototypes</p>
          <Link href="/playables/asteroid-mining/" className="mt-4 inline-block text-2xl font-black italic text-white underline decoration-[#f6c400] underline-offset-4">Asteroid Mining →</Link>
        </section>
      </div>
    </main>
  );
}
