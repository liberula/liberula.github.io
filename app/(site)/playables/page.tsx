import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playable Ads | Liberula",
  description:
    "Liberula produces compact playable ads and interactive prototypes for mobile game teams.",
  alternates: { canonical: "/playables/" },
  openGraph: {
    title: "Playable Ads | Liberula",
    description:
      "Liberula produces compact playable ads and interactive prototypes for mobile game teams.",
    type: "website",
    url: "/playables/",
    images: ["/portfolio/asteroid-miner-poster.png"],
  },
};

const projects = [
  {
    href: "/playables/asteroid-mining/",
    image: "/portfolio/asteroid-miner-poster.png",
    title: "Asteroid Mining",
    description:
      "A short hold-to-mine prototype built around heat management and a rapid path to a final CTA.",
    tags: ["HTML5", "JavaScript", "Canvas 2D", "Pointer Events"],
    facts: ["Interaction: Hold to mine", "Format: HTML5", "Focus: Short session"],
  },
  {
    href: "/playables/spinfall/",
    image: "/mobile-store/spinfall/hero.png",
    title: "Spinfall",
    description:
      "A dark fantasy combat prototype built around a wheel that drives attack, healing, defense and survival.",
    tags: ["Phaser", "JavaScript", "Web prototype"],
    facts: ["Interaction: Combat wheel", "Focus: Gameplay systems", "Format: Web prototype"],
  },
];

const offer = [
  ["01", "Hook translation", "Turn a game’s proposition into a short, clear interaction."],
  ["02", "Compact prototype development", "Build focused interactive experiences for review, pitching or testing."],
  ["03", "Review and iteration", "Adjust the playable with feedback and the desired delivery target in mind."],
];

const workflow = ["Brief and assets", "Prototype build", "Feedback and iteration", "Delivery for the target"];

export default function PlayablesIndexPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <section className="relative border-b border-white/10 px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
        <div className="absolute -right-32 top-12 h-80 w-80 rounded-full bg-[#f6c400]/[0.08] blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="text-xs font-bold tracking-[0.28em] text-[#f6c400]">PLAYABLE ADS</p>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.04em] sm:text-7xl lg:text-[5.5rem]">
              Outsourced playable ads for mobile games.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">
              Liberula turns existing game hooks and assets into compact interactive prototypes for testing, iteration and pitching.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#examples" className="rounded-full bg-[#f6c400] px-6 py-3.5 text-sm font-bold text-black transition hover:bg-white">See playable examples</a>
              <a href="mailto:gaba@liberula.com" className="rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold text-white transition hover:border-[#f6c400] hover:text-[#f6c400]">Talk to Liberula</a>
            </div>
          </div>
          <div className="mt-14 flex flex-wrap gap-3 border-t border-white/10 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-white/55">
            {["Hook-first", "Compact builds", "Interactive prototypes", "Target-specific delivery"].map((item) => <span key={item} className="rounded-full border border-white/15 px-4 py-2">{item}</span>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.24em] text-[#f6c400]">THE OFFER</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.03em] sm:text-5xl">What we do</h2>
            <p className="mt-5 leading-7 text-white/60">Liberula helps mobile teams turn existing gameplay hooks and assets into interactive playable prototypes that can be reviewed, iterated and adapted for specific delivery targets.</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {offer.map(([number, title, description]) => <div key={title} className="bg-[#111111] p-7 sm:p-8"><span className="text-sm font-bold text-[#f6c400]">{number}</span><h3 className="mt-12 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/55">{description}</p></div>)}
          </div>
        </div>
      </section>

      <section id="examples" className="border-y border-white/10 bg-[#0e0e0e] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold tracking-[0.24em] text-[#f6c400]">SELECTED WORK</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.03em] sm:text-5xl">Featured prototypes</h2>
          <p className="mt-4 text-white/55">Selected examples of gameplay interaction and prototype execution.</p>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {projects.map((project) => <article key={project.title} className="overflow-hidden rounded-2xl border border-white/10 bg-[#151515] transition hover:-translate-y-1 hover:border-[#f6c400]/50">
              <Link href={project.href} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden bg-black"><Image src={project.image} alt={`${project.title} playable prototype`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" /></div>
                <div className="p-7 sm:p-8"><p className="text-[11px] font-bold tracking-[0.18em] text-[#f6c400]">PLAYABLE AD PROTOTYPE</p><h3 className="mt-3 text-3xl font-black tracking-[-0.02em]">{project.title}</h3><p className="mt-3 min-h-[3.5rem] leading-6 text-white/60">{project.description}</p><div className="mt-6 flex flex-wrap gap-2">{project.tags.map((tag) => <span key={tag} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60">{tag}</span>)}</div><div className="mt-7 grid gap-2 border-t border-white/10 pt-5 text-xs text-white/50 sm:grid-cols-3">{project.facts.map((fact) => <span key={fact}>{fact}</span>)}</div><span className="mt-7 inline-block text-sm font-bold text-[#f6c400]">View prototype <span aria-hidden="true">↗</span></span></div>
              </Link>
            </article>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><p className="text-xs font-bold tracking-[0.24em] text-[#f6c400]">A SIMPLE PATH</p><h2 className="mt-4 text-4xl font-black tracking-[-0.03em] sm:text-5xl">How we work</h2></div><div className="mt-12 grid gap-8 border-t border-white/15 pt-8 sm:grid-cols-2 lg:grid-cols-4">{workflow.map((step, index) => <div key={step}><span className="text-sm font-bold text-[#f6c400]">0{index + 1}</span><h3 className="mt-5 font-bold">{step}</h3></div>)}</div></div></section>

      <section className="px-5 pb-24 sm:px-8 sm:pb-32"><div className="mx-auto max-w-7xl rounded-2xl bg-[#f6c400] px-7 py-12 text-black sm:px-12 sm:py-16"><h2 className="max-w-2xl text-4xl font-black tracking-[-0.03em] sm:text-5xl">Need a playable for a mobile game?</h2><p className="mt-5 max-w-xl leading-7 text-black/70">Liberula works from existing hooks and assets to create compact interactive prototypes for testing and iteration.</p><a href="mailto:gaba@liberula.com" className="mt-8 inline-block rounded-full bg-black px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white hover:text-black">Talk to Liberula</a></div></section>
    </main>
  );
}
