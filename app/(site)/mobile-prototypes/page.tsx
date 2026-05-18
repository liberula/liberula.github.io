import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import PortfolioImageGallery from "../../components/PortfolioImageGallery";

export const metadata: Metadata = {
  title: "Mobile Prototypes | Liberula",
  description:
    "Rapid gameplay prototypes, ad concepts and market-driven experiments by Liberula Games.",
};

type ConceptCard = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

type WorkCard = {
  title: string;
  description: string;
  href: string;
};

const adConcepts: ConceptCard[] = [
  {
    title: "Roulette Combat",
    description:
      "A risk-driven combat concept focused on timing, tension and instantly readable outcomes.",
    imageSrc: "/portfolio/roulette.png",
    imageAlt: "Roulette combat mobile game ad concept",
  },
  {
    title: "Dragon Miner",
    description:
      "A resource-growth fantasy where goblins mine gold to feed and empower a dragon.",
    imageSrc: "/portfolio/dragon-miner.png",
    imageAlt: "Dragon miner mobile game ad concept",
  },
  {
    title: "Feng Shui Room",
    description:
      "A satisfying optimization concept about rearranging rooms to improve invisible flow and harmony.",
    imageSrc: "/portfolio/feng-shui.png",
    imageAlt: "Feng shui room optimization mobile game ad concept",
  },
];

const releasedWork: WorkCard[] = [
  {
    title: "Meteoz",
    description: "A completed and released arcade-style game.",
    href: "https://play.google.com/store/apps/details?id=com.Eureka.Meteorz",
  },
  {
    title: "Color Pool",
    description: "A completed and released puzzle/action experiment.",
    href: "https://play.google.com/store/apps/details?id=com.WolfPack.ColorPool",
  },
  {
    title: "Recoil",
    description:
      "A completed and released game prototype focused on responsive action.",
    href: "https://store.steampowered.com/app/1949570/Recoil/",
  },
];

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-liberula-yellow">
        {eyebrow}
      </p>

      <h2 className="font-title text-3xl font-black text-white tablet:text-5xl">
        {title}
      </h2>
    </div>
  );
}

function ImageCard({
  title,
  description,
  imageSrc,
  imageAlt,
}: ConceptCard) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-liberula-yellow/60">
      <div className="relative aspect-[4/3] bg-zinc-900">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="p-6">
        <h3 className="mb-3 font-title text-2xl font-black text-white">
          {title}
        </h3>

        <p className="text-base leading-7 text-zinc-300">
          {description}
        </p>
      </div>
    </article>
  );
}

function ReleasedWorkCard({
  title,
  description,
  href,
}: WorkCard) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-black/40 p-6 transition hover:-translate-y-1 hover:border-liberula-yellow/70 hover:bg-black/70"
    >
      <h3 className="mb-3 font-title text-2xl font-black text-white">
        {title}
      </h3>

      <p className="mb-5 text-base leading-7 text-zinc-300">
        {description}
      </p>

      <span className="text-sm font-bold uppercase tracking-[0.2em] text-liberula-yellow">
        View project
      </span>
    </Link>
  );
}

export default function MobilePrototypesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-16 text-white tablet:px-10 laptop:px-16">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 pb-20 pt-8 tablet:pt-16">
        <div className="max-w-4xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.35em] text-liberula-yellow">
            Liberula Games
          </p>

          <h1 className="mb-6 font-title text-5xl font-black leading-tight text-white tablet:text-7xl laptop:text-8xl">
            Experimental Mobile Game Concepts & Prototypes
          </h1>

          <p className="max-w-3xl text-xl leading-9 text-zinc-300 tablet:text-2xl">
            Rapid gameplay prototypes, ad concepts and market-driven experiments by Liberula Games.
          </p>
        </div>

        <div className="flex flex-col gap-4 tablet:flex-row">
          <Link
            href="mailto:gaba@liberula.com"
            className="rounded-full bg-liberula-yellow px-8 py-4 text-center text-base font-black uppercase tracking-[0.18em] text-black transition hover:bg-white"
          >
            Contact
          </Link>

          <Link
            href="/"
            className="rounded-full border border-white/20 px-8 py-4 text-center text-base font-black uppercase tracking-[0.18em] text-white transition hover:border-liberula-yellow hover:text-liberula-yellow"
          >
            Visit Liberula
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl py-14">
        <SectionHeader
          eyebrow="Ad Concept Experiments"
          title="Readable hooks, fast validation."
        />

        <PortfolioImageGallery items={adConcepts} />
      </section>

      <section className="mx-auto max-w-6xl py-14">
        <SectionHeader
          eyebrow="Playable Prototype"
          title="Interaction first, friction last."
        />

        <article className="grid overflow-hidden rounded-3xl border border-liberula-yellow/40 bg-white/5 shadow-2xl shadow-black/40 laptop:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-h-[320px] bg-zinc-900 laptop:min-h-[460px]">
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              poster="/portfolio/asteroid-miner-poster.png"
            >
              <source src="/portfolio/asteroid-miner.mp4" type="video/mp4" />
            </video>
          </div>

          <div className="flex flex-col justify-center p-8 tablet:p-12">
            <h3 className="mb-4 font-title text-3xl font-black text-white tablet:text-5xl">
              Asteroid Miner Playable Ad Prototype
            </h3>

            <p className="mb-8 text-lg leading-8 text-zinc-300">
              A small playable prototype focused on immediate interaction,
              quick onboarding and mobile-friendly readability.
            </p>

            <Link
              href="https://liberula.itch.io/asteroid-mining-playable"
              className="w-fit rounded-full bg-liberula-yellow px-7 py-4 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-white"
            >
              Play prototype
            </Link>
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-6xl py-14">
        <SectionHeader
          eyebrow="Previous Released Work"
          title="Completed games and experiments."
        />

        <div className="grid gap-5 tablet:grid-cols-3">
          {releasedWork.map((work) => (
            <ReleasedWorkCard key={work.title} {...work} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl py-14 pb-24">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-8 tablet:p-12">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-liberula-yellow">
            What I’m Looking For
          </p>

          <p className="max-w-4xl text-xl leading-9 text-zinc-200 tablet:text-2xl tablet:leading-10">
            I’m currently exploring mobile publishing partnerships and fast
            validation pipelines for simple, testable gameplay concepts.
            I’m especially interested in projects where creative performance,
            CTR, early retention and marketability are part of the development
            process from day one.
          </p>
        </div>
      </section>
    </main>
  );
}