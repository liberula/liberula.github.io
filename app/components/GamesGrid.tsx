import Image from "next/image";
import Link from "next/link";

type StoreLink = {
  label: string;
  href: string;
};

type Game = {
  title: string;
  image: string;
  description: string;
  tags: string[];
  stores: StoreLink[];
  featured?: boolean;
};

const games: Game[] = [
  {
    title: "Recoil",
    image: "/images/recoil.png",
    description:
      "Recoil is a minimalist 2D platformer where you can only move by shooting. Find ways to escape the prison by solving puzzles and blasting, or sparing, enemies while collecting all the gems. But beware, The Wardens are watching.",
    tags: ["Steam", "Precision", "Platformer"],
    featured: true,
    stores: [
      {
        label: "Steam",
        href: "https://store.steampowered.com/app/1949570/Recoil/",
      },
    ],
  },
  {
    title: "Meteoz",
    image: "/images/meteoz.png",
    description:
      "In the vast space of the Deltoria sector lies a dangerous meteor field called Meteoz. Space pilots are sent there as a rite of passage, but only a few make it back. Glory awaits, and cool space ships too.",
    tags: ["Mobile", "Arcade", "Space"],
    stores: [
      {
        label: "Google Play",
        href: "https://play.google.com/store/apps/details?id=com.Eureka.Meteorz",
      },
    ],
  },
  {
    title: "Color Pool",
    image: "/images/colorpool.png",
    description:
      "Hit the correct colors at the right time. A compact mobile arcade game about timing, focus and clean execution.",
    tags: ["Mobile", "Arcade", "Timing"],
    stores: [
      {
        label: "Google Play",
        href: "https://play.google.com/store/apps/details?id=com.WolfPack.ColorPool",
      },
    ],
  },
];

function GameCard({ game }: { game: Game }) {
  return (
    <article
      className={`group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-liberula-yellow/60 hover:bg-white/[0.07] ${
        game.featured ? "laptop:col-span-2" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden bg-white/5 ${
          game.featured ? "h-[360px] tablet:h-[480px]" : "h-[260px]"
        }`}
      >
        <Image
          src={game.image}
          alt={game.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes={
            game.featured
              ? "(min-width: 1024px) 760px, 100vw"
              : "(min-width: 1024px) 370px, 100vw"
          }
          priority={game.featured}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {game.featured && (
          <div className="absolute left-5 top-5 rounded-full bg-liberula-yellow px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black">
            Latest release
          </div>
        )}
      </div>

      <div className="p-6 tablet:p-8">
        <div className="flex flex-col justify-between gap-4 tablet:flex-row tablet:items-start">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white tablet:text-4xl">
              {game.title}
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {game.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {game.stores.map((store) => (
              <Link
                key={store.href}
                href={store.href}
                className="rounded-full bg-liberula-yellow px-5 py-3 text-sm font-black text-black transition hover:bg-white"
              >
                {store.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-base leading-7 text-white/65 tablet:text-lg">
          {game.description}
        </p>
      </div>
    </article>
  );
}

export default function GamesGrid() {
  return (
    <section className="bg-black px-5 pb-24">
      <div className="mx-auto grid max-w-7xl gap-6 laptop:grid-cols-2">
        {games.map((game) => (
          <GameCard key={game.title} game={game} />
        ))}
      </div>
    </section>
  );
}