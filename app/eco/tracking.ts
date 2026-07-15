type MetaPixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: MetaPixel;
};

declare global {
  interface Window {
    fbq?: MetaPixel;
    _fbq?: MetaPixel;
  }
}

let initialized = false;
let pageViewTracked = false;
let viewContentTracked = false;

function getMetaPixel(): MetaPixel | null {
  if (typeof window === "undefined") return null;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  if (!initialized) {
    const existing = window.fbq;

    if (!existing) {
      const fbq: MetaPixel = (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue?.push(args);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }

    window.fbq?.("init", pixelId);
    initialized = true;
  }

  return window.fbq ?? null;
}

export function trackEcoPageView(): void {
  if (pageViewTracked) return;
  const fbq = getMetaPixel();
  if (!fbq) return;
  fbq("track", "PageView");
  pageViewTracked = true;
}

export function trackEcoViewContent(): void {
  if (viewContentTracked) return;
  const fbq = getMetaPixel();
  if (!fbq) return;
  fbq("track", "ViewContent", {
    content_name: "Convocação 74-B",
    content_ids: ["eco-convocacao-74b"],
    content_type: "product",
    value: 79,
    currency: "BRL",
  });
  viewContentTracked = true;
}

export function trackEcoLead(): void {
  const fbq = getMetaPixel();
  if (!fbq) return;
  fbq("track", "Lead", {
    content_name: "Convocação 74-B",
    content_ids: ["eco-convocacao-74b"],
    value: 79,
    currency: "BRL",
  });
}
