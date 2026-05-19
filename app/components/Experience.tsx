import Image from "next/image";

const CompletedProjects = () => {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-10 py-9">
      <div className="flex flex-row items-center">
        <span className="text-8xl font-black text-black desktop:text-[200px]">
          20
        </span>
        <span className="text-5xl font-black text-black desktop:text-[150px]">
          +
        </span>
      </div>

      <p className="w-full text-center text-2xl font-bold text-black/70 desktop:text-[40px]">
        Completed projects
      </p>
    </div>
  );
};

const YearOfExperience = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-10 py-14">
      <div className="flex flex-row items-end">
        <span className="text-8xl font-black text-black desktop:text-[200px]">
          7
        </span>
        <span className="mb-3 text-3xl font-black text-black desktop:text-[60px]">
          years
        </span>
      </div>

      <p className="text-center text-3xl font-bold text-black/70 desktop:text-[40px]">
        Experience
      </p>
    </div>
  );
};

const TrustedBy = () => {
  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <span className="absolute top-5 text-center text-2xl font-black text-black tablet:top-8 tablet:text-4xl">
        Trusted by
      </span>

      <Image
        className="mt-20 tablet:hidden"
        src="/images/companies.svg"
        width={160}
        height={600}
        alt="Amazon AWS, Afterverse, Space Sheep Games, Tapps"
      />

      <Image
        className="mt-14 hidden tablet:block desktop:w-[750px]"
        src="/images/companies-side.svg"
        width={600}
        height={180}
        alt="Amazon AWS, Afterverse, Space Sheep Games, Tapps"
      />
    </div>
  );
};

const ProficientWith = () => {
  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <span className="absolute top-5 text-center text-2xl font-black text-black tablet:top-8 tablet:text-4xl">
        Proficient with
      </span>

      <Image
        className="mt-16 tablet:hidden"
        src="/images/engines.svg"
        width={175}
        height={150}
        alt="Godot, Unity"
      />

      <Image
        className="mt-16 hidden tablet:block desktop:w-[750px]"
        src="/images/engines-side.svg"
        width={500}
        height={180}
        alt="Godot, Unity"
      />
    </div>
  );
};

function StatCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2rem] bg-liberula-yellow shadow-xl shadow-black/30 transition hover:-translate-y-1 hover:shadow-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export default function Experience() {
  return (
    <section className="bg-black px-5 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-liberula-yellow">
            Experience
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight text-white tablet:text-6xl">
            We build games, prototypes and interactive systems.
          </h2>
        </div>

        <div className="grid gap-6 tablet:grid-cols-2">
          <StatCard className="min-h-[280px]">
            <CompletedProjects />
          </StatCard>

          <StatCard className="min-h-[280px]">
            <YearOfExperience />
          </StatCard>

          <StatCard className="min-h-[420px] tablet:col-span-2">
            <TrustedBy />
          </StatCard>

          <StatCard className="min-h-[320px] tablet:col-span-2">
            <ProficientWith />
          </StatCard>
        </div>
      </div>
    </section>
  );
}