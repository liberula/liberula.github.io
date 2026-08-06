"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  ["Brief + assets", "You share the game, goals and available material."],
  ["Hook", "We define the interaction the playable will communicate."],
  ["Build", "We turn the concept into a compact playable."],
  ["Feedback + delivery", "We iterate and prepare the approved version."],
];

export default function PlayableProcessFlow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    if (media.matches) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="relative mt-9">
      <div className="absolute bottom-0 left-[11px] top-0 w-px bg-white/15 md:hidden" />
      <div className="absolute bottom-0 left-[11px] top-0 w-px origin-top bg-[#f6c400] transition-transform md:hidden" style={{ transform: isVisible ? "scaleY(1)" : "scaleY(0)", transitionDuration: reduceMotion ? "0ms" : "1000ms" }} />
      <div className="absolute left-0 right-0 top-[11px] hidden h-px bg-white/15 md:block" />
      <div className="absolute left-0 right-0 top-[11px] hidden h-px origin-left bg-[#f6c400] transition-transform md:block" style={{ transform: isVisible ? "scaleX(1)" : "scaleX(0)", transitionDuration: reduceMotion ? "0ms" : "1000ms" }} />
      <div className="relative grid gap-7 md:grid-cols-4 md:gap-6">
        {steps.map(([title, description], index) => (
          <div key={title} className="relative pl-9 md:pl-0 md:pt-9" style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(8px)", transition: reduceMotion ? "none" : `opacity 280ms ease ${250 + index * 220}ms, transform 280ms ease ${250 + index * 220}ms` }}>
            <span className="absolute left-0 top-0 flex h-[23px] w-[23px] items-center justify-center rounded-full border border-[#f6c400] bg-[#0a0a0a] text-[10px] font-bold text-[#f6c400]">{index + 1}</span>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
