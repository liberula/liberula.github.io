import BigButton from "./BigButton";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-black">
      <div className="absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-liberula-yellow/20 blur-3xl" />
      <div className="absolute bottom-[-240px] right-[-220px] h-[520px] w-[520px] rounded-full bg-liberula-yellow/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-5 py-20 tablet:py-28 laptop:grid laptop:grid-cols-[1.1fr_0.9fr] laptop:items-center laptop:gap-16">
        <div className="flex flex-col items-center text-center laptop:items-start laptop:text-left">
          <div className="mb-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-liberula-yellow shadow-sm">
            GAMEPLAY-FIRST STUDIO
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl tablet:text-7xl laptop:text-8xl">
            Here your choices matter.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70 tablet:text-xl">
            We create games where players improvise, discover, experiment and
            feel the consequences of their decisions.
          </p>

          <div className="mt-8">
            <BigButton label="Check our games" link="/games" className="" />
          </div>
        </div>

        <div className="relative flex w-full justify-center">
          <div className="absolute inset-0 rounded-full bg-liberula-yellow/20 blur-3xl" />

          <div className="relative rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
            <Image
              className="h-[300px] w-[300px] object-contain tablet:h-[420px] tablet:w-[420px] laptop:h-[480px] laptop:w-[480px]"
              src="/images/hero-image.svg"
              width={500}
              height={500}
              alt="gameplay freedom"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}