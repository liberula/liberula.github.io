import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo-white.svg"
            width={46}
            height={46}
            alt="Liberula"
            priority
          />

          <span className="hidden text-xl font-black tracking-tight text-white mobile-l:inline">
            LIBERULA
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm font-bold text-white/70">
          <Link href="/games" className="hidden transition hover:text-liberula-yellow tablet:inline">
            Games
          </Link>

          <Link
            href="https://subscribepage.io/liberula"
            className="hidden transition hover:text-liberula-yellow laptop:inline"
          >
            Newsletter
          </Link>

          <Link href="/about" className="hidden transition hover:text-liberula-yellow laptop:inline">
            About
          </Link>

          <Link
            href="mailto:gaba@liberula.com"
            className="rounded-full bg-liberula-yellow px-4 py-2 text-black transition hover:bg-white"
          >
            Contact
          </Link>
        </div>
      </div>
    </nav>
  );
}