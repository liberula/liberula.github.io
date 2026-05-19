import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer id="footer" className="border-t border-white/10 bg-black px-5 py-12 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 tablet:flex-row tablet:items-center tablet:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo-white.svg"
            width={52}
            height={52}
            alt="Liberula"
          />

          <div>
            <p className="text-xl font-black tracking-tight">LIBERULA</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-white/55">
              Games where choices matter, systems respond and players create
              the stories worth telling.
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap gap-4 text-sm font-bold text-white/65">
          <Link href="/games" className="transition hover:text-liberula-yellow">
            Games
          </Link>

          <Link
            href="/mobile-prototypes"
            className="transition hover:text-liberula-yellow"
          >
            Experiments
          </Link>

          <Link href="/about" className="transition hover:text-liberula-yellow">
            About
          </Link>

          <Link
            href="https://subscribepage.io/liberula"
            className="transition hover:text-liberula-yellow"
          >
            Newsletter
          </Link>

          <Link
            href="mailto:gaba@liberula.com"
            className="transition hover:text-liberula-yellow"
          >
            Contact
          </Link>
        </nav>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 tablet:flex-row tablet:items-center tablet:justify-between">
        <span>© LIBERULA 2024</span>

        <div className="flex gap-4">
          <Link href="/tos" className="transition hover:text-white">
            Terms of Service
          </Link>

          <Link href="/privacy-policy" className="transition hover:text-white">
            Privacy Policy
          </Link>

          <Link href="/" className="transition hover:text-white">
            Back to top
          </Link>
        </div>
      </div>
    </footer>
  );
}