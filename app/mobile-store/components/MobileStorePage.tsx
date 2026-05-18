"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { StoreGame, StoreImage } from "../data/games";

type StoreVariant = "ios" | "android";

type MobileStorePageProps = {
  game: StoreGame;
};

declare global {
  interface Window {
    goatcounter?: {
      count?: (event: {
        path: string;
        title?: string;
        event?: boolean;
      }) => void;
    };
  }
}

function detectStoreVariant(): StoreVariant {
  if (typeof window === "undefined") {
    return "android";
  }

  const params = new URLSearchParams(window.location.search);
  const forcedStore = params.get("store");

  if (forcedStore === "ios" || forcedStore === "android") {
    return forcedStore;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac = userAgent.includes("macintosh") && "ontouchend" in document;

  if (
    userAgent.includes("iphone") ||
    userAgent.includes("ipad") ||
    userAgent.includes("ipod") ||
    isTouchMac
  ) {
    return "ios";
  }

  return "android";
}

function trackInstallClick(game: StoreGame, variant: StoreVariant) {
  const eventPath = `/mobile-store/${game.slug}/install-click/${variant}`;

  if (typeof window !== "undefined" && window.goatcounter?.count) {
    window.goatcounter.count({
      path: eventPath,
      title: `${game.title} Install Click (${variant})`,
      event: true,
    });
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} stars`} className="text-sm tracking-tight">
      {"★".repeat(Math.round(rating))}
    </span>
  );
}

function ScreenshotCard({ image, priority }: { image: StoreImage; priority?: boolean }) {
  return (
    <div className="relative h-[360px] min-w-[205px] overflow-hidden rounded-2xl bg-neutral-100 shadow-sm">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        className="object-cover"
        sizes="205px"
        priority={priority}
      />

      {image.caption && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {image.caption}
        </div>
      )}
    </div>
  );
}

function MediaCarousel({ game }: { game: StoreGame }) {
  const images = [game.heroScreenshot, ...game.gameplaySteps];

  return (
    <section className="mt-6">
      <div className="flex gap-3 overflow-x-auto pb-4">
        {images.map((image, index) => (
          <ScreenshotCard
            key={image.src}
            image={image}
            priority={index === 0}
          />
        ))}
      </div>
    </section>
  );
}

function InstallNotice() {
  return (
    <div className="mt-4 rounded-2xl bg-neutral-100 p-4 text-sm leading-6 text-neutral-800">
      This prototype is not available yet. Your install intent was recorded.
    </div>
  );
}

function IOSStorePage({ game }: { game: StoreGame }) {
  const [clickedInstall, setClickedInstall] = useState(false);

  function handleInstallClick() {
    trackInstallClick(game, "ios");
    setClickedInstall(true);
  }

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-[720px] px-5 py-5">
        <div className="mb-4 flex items-center justify-between text-sm text-blue-600">
          <span>Games</span>
          <span>Share</span>
        </div>

        <section className="flex gap-4 border-b border-neutral-200 pb-6">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[24px] bg-neutral-100 shadow-sm">
            <Image
              src={game.icon}
              alt={`${game.title} icon`}
              fill
              className="object-cover"
              sizes="112px"
              priority
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="text-2xl font-semibold leading-tight">
              {game.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">{game.subtitle}</p>
            <p className="mt-1 text-sm text-blue-600">{game.developer}</p>

            <div className="mt-auto flex items-center gap-3 pt-4">
              <button
                onClick={handleInstallClick}
                className="rounded-full bg-blue-600 px-7 py-1.5 text-sm font-bold uppercase text-white active:scale-95"
              >
                Get
              </button>

              <span className="text-xs text-neutral-500">
                {game.hasInAppPurchases ? "In-App Purchases" : game.price}
              </span>
            </div>
          </div>
        </section>

        {clickedInstall && <InstallNotice />}

        <section className="grid grid-cols-4 border-b border-neutral-200 py-5 text-center text-xs text-neutral-500">
          <div>
            <div className="text-lg font-semibold text-neutral-800">
              {game.rating}
            </div>
            <div>{game.ratingsCount} Ratings</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-neutral-800">
              {game.ageRating}
            </div>
            <div>Age</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-neutral-800">
              {game.category}
            </div>
            <div>Category</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-neutral-800">
              {game.size}
            </div>
            <div>Size</div>
          </div>
        </section>

        <MediaCarousel game={game} />

        <section className="border-t border-neutral-200 py-5">
          <h2 className="text-xl font-semibold">What’s New</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            {game.whatsNew}
          </p>
        </section>

        <section className="border-t border-neutral-200 py-5">
          <h2 className="text-xl font-semibold">Description</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            {game.description}
          </p>
        </section>

        <section className="border-t border-neutral-200 py-5">
          <h2 className="text-xl font-semibold">Ratings & Reviews</h2>

          <div className="mt-4 grid gap-3">
            {game.reviews.map((review) => (
              <article
                key={`${review.author}-${review.title}`}
                className="rounded-2xl bg-neutral-100 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{review.title}</h3>
                  <span className="text-xs text-neutral-500">
                    {review.author}
                  </span>
                </div>
                <div className="mt-1 text-yellow-600">
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  {review.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function AndroidStorePage({ game }: { game: StoreGame }) {
  const [clickedInstall, setClickedInstall] = useState(false);

  function handleInstallClick() {
    trackInstallClick(game, "android");
    setClickedInstall(true);
  }

  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-[720px] px-5 py-5">
        <div className="mb-5 flex items-center justify-between text-sm text-neutral-600">
          <span>←</span>
          <span>Search</span>
        </div>

        <section className="flex gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 shadow-sm">
            <Image
              src={game.icon}
              alt={`${game.title} icon`}
              fill
              className="object-cover"
              sizes="96px"
              priority
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-medium leading-tight">{game.title}</h1>
            <p className="mt-1 text-sm font-medium text-green-700">
              {game.developer}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Contains ads ·{" "}
              {game.hasInAppPurchases ? "In-app purchases" : game.price}
            </p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-4 text-center text-xs text-neutral-500">
          <div>
            <div className="text-base font-semibold text-neutral-800">
              {game.rating}★
            </div>
            <div>{game.ratingsCount} reviews</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-800">
              {game.installs ?? "10K+"}
            </div>
            <div>Downloads</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-800">
              {game.ageRating}
            </div>
            <div>Rated for</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-800">
              {game.category}
            </div>
            <div>Category</div>
          </div>
        </section>

        <button
          onClick={handleInstallClick}
          className="mt-6 w-full rounded-full bg-green-700 py-3 text-sm font-semibold text-white active:scale-[0.99]"
        >
          Install
        </button>

        {clickedInstall && <InstallNotice />}

        <MediaCarousel game={game} />

        <section className="border-t border-neutral-200 py-5">
          <h2 className="text-xl font-medium">About this game</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            {game.description}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700">
              {game.category}
            </span>
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700">
              Offline
            </span>
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700">
              Single player
            </span>
          </div>
        </section>

        <section className="border-t border-neutral-200 py-5">
          <h2 className="text-xl font-medium">What’s new</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-700">
            {game.whatsNew}
          </p>
        </section>

        <section className="border-t border-neutral-200 py-5">
          <h2 className="text-xl font-medium">Ratings and reviews</h2>

          <div className="mt-4 grid gap-3">
            {game.reviews.map((review) => (
              <article
                key={`${review.author}-${review.title}`}
                className="rounded-2xl bg-neutral-100 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{review.title}</h3>
                  <span className="text-xs text-neutral-500">
                    {review.author}
                  </span>
                </div>
                <div className="mt-1 text-yellow-600">
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  {review.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function MobileStorePage({ game }: MobileStorePageProps) {
  const [variant, setVariant] = useState<StoreVariant>("android");

  useEffect(() => {
    setVariant(detectStoreVariant());
  }, []);

  const page = useMemo(() => {
    if (variant === "ios") {
      return <IOSStorePage game={game} />;
    }

    return <AndroidStorePage game={game} />;
  }, [game, variant]);

  return page;
}