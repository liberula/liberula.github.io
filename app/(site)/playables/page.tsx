import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import PlayableProcessFlow from "../../components/PlayableProcessFlow";

export const metadata: Metadata = {
  title: "Playable Ads | Liberula",
  description: "Liberula develops outsourced playable ads for mobile games.",
  alternates: { canonical: "/playables/" },
  openGraph: { title: "Playable Ads | Liberula", description: "Liberula develops outsourced playable ads for mobile games.", type: "website", url: "/playables/", images: ["/portfolio/asteroid-miner-poster.png"] },
};

const projects = [
  { href: "/playables/asteroid-mining/", image: "/portfolio/asteroid-miner-poster.png", badge: "PLAYABLE AD PROTOTYPE", title: "Asteroid Mining", description: "Mine asteroids, manage weapon heat and progress toward a final CTA.", interaction: "Hold to mine" },
  { href: "/playables/spinfall/", image: "/portfolio/spinfall-poster.png", badge: "PLAYABLE AD PROTOTYPE", title: "Spinfall", description: "Spin a combat wheel to attack, recover and survive against a boss.", interaction: "Combat wheel" },
];

export default function PlayablesIndexPage() {
  return <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
    <section className="px-5 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-24"><div className="mx-auto max-w-6xl"><div className="max-w-3xl"><p className="text-xs font-bold tracking-[0.28em] text-[#f6c400]">PLAYABLE ADS</p><h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.04em] sm:text-7xl">Playable ads for mobile games.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">Liberula turns existing game hooks and assets into compact interactive experiences.</p><div className="mt-8 flex flex-wrap gap-4"><a href="#playables" className="rounded-full bg-[#f6c400] px-6 py-3.5 text-sm font-bold text-black transition hover:bg-white">View our work</a><a href="mailto:gaba@liberula.com" className="rounded-full border border-white/25 px-6 py-3.5 text-sm font-bold text-white transition hover:border-[#f6c400] hover:text-[#f6c400]">Talk to Liberula</a></div></div></div></section>

    <section id="playables" className="px-5 pb-20 sm:px-8 sm:pb-24"><div className="mx-auto max-w-6xl"><h2 className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">Playable prototypes</h2><div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">{projects.map((project) => <article key={project.title} className="h-full overflow-hidden rounded-2xl border border-white/10 bg-[#151515] transition hover:-translate-y-1 hover:border-[#f6c400]/50"><Link href={project.href} className="group grid h-full md:grid-cols-[1.05fr_1fr]"><div className="relative min-h-[230px] overflow-hidden bg-black md:min-h-0"><Image src={project.image} alt={`${project.title} playable prototype`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /><div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" /></div><div className="flex h-full flex-col p-7 sm:p-8"><p className="text-[11px] font-bold tracking-[0.18em] text-[#f6c400]">{project.badge}</p><h3 className="mt-3 text-3xl font-black tracking-[-0.02em]">{project.title}</h3><p className="mt-3 text-sm leading-6 text-white/60">{project.description}</p><div className="mt-6 border-t border-white/10 pt-4"><span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Core interaction</span><p className="mt-1 font-bold text-white">{project.interaction}</p></div><span className="mt-auto pt-7 text-sm font-bold text-[#f6c400]">Play prototype <span aria-hidden="true">&rarr;</span></span></div></Link></article>)}</div></div></section>

    <section className="px-5 pb-20 sm:px-8 sm:pb-24"><div className="mx-auto max-w-6xl"><p className="text-xs font-bold tracking-[0.24em] text-[#f6c400]">FROM BRIEF TO BUILD</p><h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-4xl">A simple production flow.</h2><PlayableProcessFlow /></div></section>

    <section className="px-5 pb-24 sm:px-8 sm:pb-28"><div className="mx-auto max-w-6xl rounded-2xl bg-[#f6c400] px-7 py-8 text-black sm:px-10 sm:py-9"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><h2 className="text-3xl font-black tracking-[-0.03em] sm:text-4xl">Need a playable for your mobile game?</h2><p className="mt-3 text-black/70">Send us the game, the brief and the available assets.</p></div><a href="mailto:gaba@liberula.com" className="inline-block shrink-0 rounded-full bg-black px-6 py-3.5 text-center text-sm font-bold text-white transition hover:bg-white hover:text-black">Talk to Liberula</a></div></div></section>
  </main>;
}
