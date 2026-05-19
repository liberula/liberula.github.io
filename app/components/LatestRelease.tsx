import Link from "next/link";
import YellowTag from "./YellowTag";

export default function LatestRelease() {
  return (
    <section className="bg-black px-5 py-14 tablet:py-20">
      <div className="mx-auto max-w-7xl">
        <YellowTag label="Latest Release" />

        <div className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40">
          <div className="grid gap-0 laptop:grid-cols-[1fr_0.72fr]">
            <div className="p-7 tablet:p-10 laptop:p-12">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-liberula-yellow">
                Recoil
              </p>

              <h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white tablet:text-6xl">
                Ricochet through a minimalist arcade gauntlet.
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 tablet:text-lg">
                A compact precision arcade game about timing, movement and
                surviving your own shots.
              </p>

              <div className="mt-8 flex flex-col gap-3 mobile-l:flex-row">
                <Link
                  href="https://store.steampowered.com/app/1949570/Recoil/"
                  className="rounded-full bg-liberula-yellow px-6 py-3 text-center text-sm font-black text-black transition hover:bg-white"
                >
                  Get it on Steam
                </Link>

                <Link
                  href="https://www.youtube.com/watch?v=1AyNbM9UYVg"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-bold text-white transition hover:border-liberula-yellow hover:text-liberula-yellow"
                >
                  Watch trailer
                </Link>
              </div>
            </div>

            <div className="relative flex min-h-[260px] items-center justify-center border-t border-white/10 bg-black/40 p-8 laptop:border-l laptop:border-t-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(246,196,0,0.20),_transparent_55%)]" />

              <div className="relative flex h-48 w-48 items-center justify-center rounded-[2rem] border border-liberula-yellow/30 bg-liberula-yellow text-black shadow-2xl shadow-liberula-yellow/20 tablet:h-56 tablet:w-56">
                <div className="text-center">
                  <p className="text-6xl font-black leading-none tablet:text-7xl">
                    R
                  </p>

                  <p className="mt-2 text-xs font-black uppercase tracking-[0.24em]">
                    Recoil
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}