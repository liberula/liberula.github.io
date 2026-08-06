import Link from "next/link";
import styles from "./Hero.module.css";

const projects = [
  {
    name: "Asteroid Mining",
    label: "ASTEROID MINING",
    interaction: "HOLD TO MINE",
    image: "/playables/hero/asteroid-mining.webp",
    alt: "Asteroid Mining playable ad showing a spacecraft mining an asteroid",
    className: styles.asteroidCard,
  },
  {
    name: "Spinfall",
    label: "SPINFALL",
    interaction: "COMBAT WHEEL",
    image: "/playables/hero/spinfall.webp",
    alt: "Spinfall playable ad showing a combat wheel and boss battle",
    className: styles.spinfallCard,
  },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#080808]">
      <div aria-hidden="true" className="absolute left-[-18rem] top-24 h-80 w-80 rounded-full bg-liberula-yellow/10 blur-3xl" />
      <div aria-hidden="true" className="absolute right-[-12rem] top-20 h-[30rem] w-[30rem] rounded-full bg-orange-600/10 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-12 px-5 py-16 tablet:px-8 tablet:py-20 laptop:min-h-[700px] laptop:grid-cols-[0.85fr_1.15fr] laptop:gap-12 laptop:py-24">
        <div className="relative z-10">
          <p className={`${styles.copyFirst} text-xs font-black tracking-[0.2em] text-liberula-yellow tablet:text-sm`}>
            PLAYABLE PRODUCTION FOR MOBILE GAMES
          </p>

          <h1 className={`${styles.copyFirst} mt-5 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.045em] text-white mobile-l:text-6xl tablet:text-7xl laptop:text-[4.25rem] laptop-l:text-[4.75rem]`}>
            Playable ads built from your game.
          </h1>

          <div className={styles.copySecond}>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/70 tablet:text-lg tablet:leading-8">
              Send us the brief and existing assets. We turn the core hook into a compact HTML5 playable, iterate with your team and prepare the approved build.
            </p>

            <div className="mt-7 flex flex-col gap-3 mobile-l:flex-row">
              <Link href="/playables/" className="rounded-full bg-liberula-yellow px-6 py-3.5 text-center text-sm font-black text-black transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-liberula-yellow">
                See playable work
              </Link>
              <a href="mailto:gaba@liberula.com" className="rounded-full border border-white/20 bg-white/[0.03] px-6 py-3.5 text-center text-sm font-bold text-white transition hover:border-liberula-yellow hover:text-liberula-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-liberula-yellow">
                Talk to Liberula
              </a>
            </div>

          </div>
        </div>

        <div className={`${styles.visuals} relative z-10 mx-auto w-full max-w-[650px] pt-8 laptop:pt-0`} aria-label="Playable ad examples">
          <div aria-hidden="true" className="absolute right-[3%] top-[7%] h-[65%] w-[65%] rounded-full bg-red-700/20 blur-3xl" />
          {projects.map((project) => (
            <article key={project.name} className={`${styles.projectCard} ${project.className} relative overflow-hidden rounded-2xl border border-white/20 bg-[#151515] shadow-2xl shadow-black/70`}>
              <div className={styles.mediaFrame}>
                <img src={project.image} alt={project.alt} className={styles.mediaImage} />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 tablet:px-5">
                <span className="text-[10px] font-black tracking-[0.16em] text-white tablet:text-xs">{project.label}</span>
                <span className="flex items-center gap-2 text-[9px] font-bold tracking-[0.12em] text-liberula-yellow tablet:text-[10px]"><i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-liberula-yellow shadow-[0_0_10px_#f6c400]" />{project.interaction}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 bg-gradient-to-b from-transparent to-black" />
    </section>
  );
}
