import Link from "next/link";

const values = [
  {
    title: "Efficacy over efficiency",
    description:
      "We prioritize meaningful outcomes over looking busy or optimizing the wrong thing.",
  },
  {
    title: "Done is better than perfect",
    description:
      "We ship, learn and improve instead of hiding behind endless polish.",
  },
  {
    title: "Scientific method",
    description:
      "We use prototypes, tests and evidence to guide creative decisions.",
  },
  {
    title: "Extreme ownership",
    description:
      "We take responsibility for our work, results and mistakes.",
  },
];

const philosophy = [
  {
    title: "Agency",
    description:
      "Player choices should create visible consequences, not just cosmetic variation.",
  },
  {
    title: "Discovery",
    description:
      "Good systems should reveal unexpected possibilities through play.",
  },
  {
    title: "Readable chaos",
    description:
      "Surprise is valuable when players can understand why it happened.",
  },
];

export default function About() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden px-5 py-20 tablet:py-28">
        <div className="absolute left-1/2 top-[-260px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-liberula-yellow/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-liberula-yellow">
            About Liberula
          </p>

          <h1 className="mt-4 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight text-white tablet:text-7xl laptop:text-8xl">
            Games where choices matter.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65 tablet:text-xl">
            Liberula is an independent game studio from São Paulo, Brazil,
            founded in 2024. We create gameplay-focused experiences built around
            agency, discovery and consequence.
          </p>

          <div className="mt-8 flex flex-col gap-3 mobile-l:flex-row">
            <Link
              href="/games"
              className="rounded-full bg-liberula-yellow px-6 py-3 text-center text-sm font-black text-black transition hover:bg-white"
            >
              See our games
            </Link>

            <Link
              href="mailto:gaba@liberula.com"
              className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-bold text-white transition hover:border-liberula-yellow hover:text-liberula-yellow"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto grid max-w-7xl gap-6 laptop:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30 tablet:p-10">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-liberula-yellow">
              Mission
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-white tablet:text-5xl">
              Create games that generate stories players want to share.
            </h2>

            <p className="mt-5 text-base leading-8 text-white/65 tablet:text-lg">
              We care about systems that let players improvise, experiment and
              discover meaningful outcomes through play.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30 tablet:p-10">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-liberula-yellow">
              Vision
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-white tablet:text-5xl">
              Build a studio known for systemic, memorable games.
            </h2>

            <p className="mt-5 text-base leading-8 text-white/65 tablet:text-lg">
              Our long-term goal is to create games that stay alive after the
              session ends through stories, discoveries, strategies and moments
              players remember.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-black px-5 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-liberula-yellow">
              Philosophy
            </p>

            <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white tablet:text-6xl">
              We design for player agency inside readable systems.
            </h2>
          </div>

          <div className="grid gap-6 laptop:grid-cols-3">
            {philosophy.map((item) => (
              <div
                key={item.title}
                className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30"
              >
                <h3 className="text-2xl font-black text-white">
                  {item.title}
                </h3>

                <p className="mt-4 text-base leading-7 text-white/65">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black px-5 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-liberula-yellow">
              Values
            </p>

            <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white tablet:text-6xl">
              Practical principles for making better games.
            </h2>
          </div>

          <div className="grid gap-6 tablet:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-[2rem] border border-liberula-yellow/20 bg-liberula-yellow p-7 text-black shadow-2xl shadow-black/30 tablet:p-8"
              >
                <h3 className="text-2xl font-black tracking-tight">
                  {value.title}
                </h3>

                <p className="mt-4 text-base font-medium leading-7 text-black/70">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}