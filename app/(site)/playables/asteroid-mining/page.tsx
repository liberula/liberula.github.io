import Link from "next/link";

export default function AsteroidMiningPlayablePage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-12 text-white sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(300px,430px)_1fr] lg:items-start">
        <section>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-[#f6c400]">
            Playable Ad Prototype
          </p>
          <h1 className="text-5xl font-black italic leading-none sm:text-7xl">
            Asteroid Mining
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-300">
            A short portrait-oriented HTML5 experience built around a hold-to-mine interaction,
            heat management and rapid progression toward a final CTA.
          </p>
          <p className="mt-4 text-neutral-300">
            Built with JavaScript, HTML5 Canvas and Pointer Events.
          </p>
          <div className="mt-7 flex flex-wrap gap-2" aria-label="Technologies">
            {["HTML5", "JavaScript", "Canvas 2D", "Pointer Events", "WebP"].map(technology => (
              <span key={technology} className="border border-neutral-700 px-3 py-2 text-sm text-neutral-200">
                {technology}
              </span>
            ))}
          </div>
          <div className="mt-8 border-l-4 border-[#f6c400] bg-neutral-900 p-5 text-sm leading-relaxed text-neutral-300">
            <p>The final CTA is configured in portfolio mode and does not redirect to an app store.</p>
            <p className="mt-3">
              This is a portfolio prototype. Network-specific packages are implemented and validated
              separately for each delivery target.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-5 text-sm font-bold uppercase tracking-wide">
            <a className="text-[#f6c400] underline underline-offset-4" href="/playables/asteroid-mining/runtime/TECHNICAL-SHEET.md">
              Technical sheet
            </a>
            <Link className="text-white underline underline-offset-4" href="/contact/">
              Contact Liberula
            </Link>
          </div>
          <div id="playable-event-panel" className="mt-8" aria-label="Reserved for a future gameplay event panel" />
        </section>

        <section className="mx-auto w-full max-w-[430px]" aria-label="Asteroid Mining playable">
          <div className="overflow-hidden border border-neutral-700 bg-black shadow-2xl shadow-black/50">
            <iframe
              title="Asteroid Mining playable ad prototype"
              src="/playables/asteroid-mining/runtime/index.html"
              className="block aspect-[9/16] w-full border-0"
              allow="fullscreen"
            />
          </div>
          <p className="mt-3 text-center text-xs text-neutral-500">
            Hold inside the playable to mine. Release to cool the weapon.
          </p>
        </section>
      </div>
    </main>
  );
}
