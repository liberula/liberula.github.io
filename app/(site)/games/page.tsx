import GamesGrid from "../../components/GamesGrid";

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden px-5 py-20 tablet:py-28">
        <div className="absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-liberula-yellow/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-liberula-yellow">
            Games
          </p>

          <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-white tablet:text-7xl laptop:text-8xl">
            Our games.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65 tablet:text-xl">
            Finished games released by Liberula, from arcade precision to mobile
            experiments.
          </p>
        </div>
      </section>

      <GamesGrid />
    </main>
  );
}