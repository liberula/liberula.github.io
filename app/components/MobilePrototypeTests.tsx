import Image from "next/image";
import Link from "next/link";
import { mobileStoreGames } from "../mobile-store/data/games";

const featuredSlugs = ["dragon-goblins", "feng-shui", "roulette-hero"];

const featuredGames = featuredSlugs
  .map((slug) => mobileStoreGames[slug])
  .filter(Boolean);

export default function MobilePrototypeTests() {
  return (
    <section className="relative overflow-hidden bg-black px-5 py-20 tablet:py-28">
      <div className="absolute left-[-240px] top-20 h-[520px] w-[520px] rounded-full bg-liberula-yellow/10 blur-3xl" />
      <div className="absolute bottom-[-260px] right-[-220px] h-[620px] w-[620px] rounded-full bg-liberula-yellow/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-6 tablet:flex-row tablet:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-liberula-yellow">
              Mobile concept tests
            </p>

            <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white tablet:text-6xl">
              Experimental game ideas tested like real mobile apps.
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
              Rapid concepts, store-like pages and install-intent tests before
              expensive production. Less guessing, more signal.
            </p>
          </div>

          <Link
            href="/mobile-prototypes"
            className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-bold text-white transition hover:border-liberula-yellow hover:text-liberula-yellow"
          >
            View prototype portfolio
          </Link>
        </div>

        <div className="grid gap-6 laptop:grid-cols-3">
          {featuredGames.map((game) => (
            <Link
              key={game.slug}
              href={`/mobile-store/${game.slug}`}
              className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-liberula-yellow/60 hover:bg-white/[0.07]"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/10">
                  <Image
                    src={game.icon}
                    alt={`${game.title} icon`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>

                <div>
                  <h3 className="text-xl font-black leading-tight text-white">
                    {game.title}
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-white/60">
                    {game.subtitle}
                  </p>
                </div>
              </div>

              <div className="relative mt-4 h-[420px] overflow-hidden rounded-[1.5rem] bg-white/5">
                <Image
                  src={game.heroScreenshot.src}
                  alt={game.heroScreenshot.alt}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(min-width: 1024px) 370px, 100vw"
                />

                {game.heroScreenshot.caption && (
                  <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/75 px-4 py-3 text-center text-sm font-black uppercase tracking-wide text-white backdrop-blur-sm">
                    {game.heroScreenshot.caption}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">
                    {game.category}
                  </span>

                  <span className="rounded-full bg-liberula-yellow px-3 py-1 text-xs font-bold text-black">
                    Store test
                  </span>
                </div>

                <span className="text-sm font-bold text-liberula-yellow">
                  View →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}