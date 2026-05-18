"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type PortfolioImage = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

type PortfolioImageGalleryProps = {
  items: PortfolioImage[];
};

export default function PortfolioImageGallery({
  items,
}: PortfolioImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(
    null,
  );

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedImage(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage]);

  return (
    <>
      <div className="grid gap-6 laptop:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setSelectedImage(item)}
            className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-liberula-yellow/60"
          >
            <div className="relative aspect-[4/3] bg-zinc-900">
              <Image
                src={item.imageSrc}
                alt={item.imageAlt}
                fill
                sizes="(min-width: 1024px) 33vw, 100vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />

              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100">
                <span className="m-4 rounded-full bg-liberula-yellow px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black">
                  View image
                </span>
              </div>
            </div>

            <div className="p-6">
              <h3 className="mb-3 font-title text-2xl font-black text-white">
                {item.title}
              </h3>

              <p className="text-base leading-7 text-zinc-300">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 tablet:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setSelectedImage(null)}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:border-liberula-yellow hover:text-liberula-yellow tablet:right-8 tablet:top-8"
          >
            Close
          </button>

          <div
            className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-[65vh] min-h-[320px] w-full bg-black">
              <Image
                src={selectedImage.imageSrc}
                alt={selectedImage.imageAlt}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>

            <div className="border-t border-white/10 p-5 tablet:p-6">
              <h3 className="mb-2 font-title text-2xl font-black text-white tablet:text-3xl">
                {selectedImage.title}
              </h3>

              <p className="text-base leading-7 text-zinc-300">
                {selectedImage.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}