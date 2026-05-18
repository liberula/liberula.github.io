export type StoreImage = {
  src: string;
  alt: string;
  caption?: string;
};

export type StoreReview = {
  author: string;
  rating: number;
  title: string;
  body: string;
};

export type StoreGame = {
  slug: string;
  title: string;
  subtitle: string;
  developer: string;
  icon: string;
  heroScreenshot: StoreImage;
  gameplaySteps: StoreImage[];
  rating: string;
  ratingsCount: string;
  ageRating: string;
  category: string;
  size: string;
  price: string;
  hasInAppPurchases: boolean;
  installs?: string;
  shortDescription: string;
  description: string;
  whatsNew: string;
  reviews: StoreReview[];
};

export const mobileStoreGames: Record<string, StoreGame> = {
  "dragon-goblins": {
    slug: "dragon-goblins",
    title: "Goblin Gold Rush",
    subtitle: "Mine gold. Feed the dragon. Go deeper.",
    developer: "Liberula Games",
    icon: "/mobile-store/dragon-goblins/icon.png",
    heroScreenshot: {
      src: "/mobile-store/dragon-goblins/hero.png",
      alt: "A dragon sitting on a giant pile of gold",
      caption: "Feed the dragon",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/dragon-goblins/step-1.png",
        alt: "Goblins mining gold underground",
        caption: "Assign goblins",
      },
      {
        src: "/mobile-store/dragon-goblins/step-2.png",
        alt: "Gold transport bottleneck in the mine",
        caption: "Fix bottlenecks",
      },
      {
        src: "/mobile-store/dragon-goblins/step-3.png",
        alt: "Dragon growing as gold arrives",
        caption: "Go deeper",
      },
    ],
    rating: "4.8",
    ratingsCount: "12K",
    ageRating: "9+",
    category: "Simulation",
    size: "128 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "100K+",
    shortDescription: "Build a goblin mining machine for a very impatient dragon.",
    description:
      "Assign goblins, fix bottlenecks, expand the mine and keep the gold flowing. Every layer creates new problems, and every upgrade changes how your goblin operation behaves.",
    whatsNew:
      "New prototype build with deeper mines, clearer gold flow and improved dragon feedback.",
    reviews: [
      {
        author: "Marcos R.",
        rating: 5,
        title: "The bottlenecks are weirdly satisfying",
        body: "I liked that it is not just bigger numbers. Moving workers around actually changes the flow.",
      },
      {
        author: "Ana P.",
        rating: 5,
        title: "More tactical than it looks",
        body: "The dragon is funny, but the best part is fixing the mine when everything gets stuck.",
      },
    ],
  },

  "feng-shui": {
    slug: "feng-shui",
    title: "Feng Shui Fixer",
    subtitle: "Arrange rooms. Fix the flow. Please impossible clients.",
    developer: "Liberula Games",
    icon: "/mobile-store/feng-shui/icon.png",
    heroScreenshot: {
      src: "/mobile-store/feng-shui/hero.png",
      alt: "A beautiful cozy room with perfect energy flow",
      caption: "Fix the flow",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/feng-shui/step-1.png",
        alt: "Client asking for a better room layout",
        caption: "Read the brief",
      },
      {
        src: "/mobile-store/feng-shui/step-2.png",
        alt: "Player moving furniture around the room",
        caption: "Move furniture",
      },
      {
        src: "/mobile-store/feng-shui/step-3.png",
        alt: "Room score improving after rearrangement",
        caption: "Perfect the room",
      },
    ],
    rating: "4.7",
    ratingsCount: "8K",
    ageRating: "4+",
    category: "Puzzle",
    size: "96 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "50K+",
    shortDescription: "A cozy puzzle game about rooms that feel wrong.",
    description:
      "Read the client brief, arrange furniture, improve the flow and turn awkward rooms into balanced spaces. Every object placement affects comfort, harmony and score.",
    whatsNew:
      "New room scoring prototype with clearer flow lines and client feedback.",
    reviews: [
      {
        author: "Julia M.",
        rating: 5,
        title: "I kept moving the couch",
        body: "It is simple, but I immediately wanted to make the room feel better.",
      },
      {
        author: "Renato C.",
        rating: 4,
        title: "Good cozy puzzle idea",
        body: "The flow visualization makes the room problems easy to understand.",
      },
    ],
  },

  "roulette-hero": {
    slug: "roulette-hero",
    title: "Roulette Hero",
    subtitle: "Build the wheel. Time the spin. Survive the run.",
    developer: "Liberula Games",
    icon: "/mobile-store/roulette-hero/icon.png",
    heroScreenshot: {
      src: "/mobile-store/roulette-hero/hero.png",
      alt: "A hero almost dying while a roulette wheel spins",
      caption: "Everything on the line",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/roulette-hero/step-1.png",
        alt: "Player choosing roulette wheel segments",
        caption: "Build your wheel",
      },
      {
        src: "/mobile-store/roulette-hero/step-2.png",
        alt: "The wheel spinning during combat",
        caption: "Time it right",
      },
      {
        src: "/mobile-store/roulette-hero/step-3.png",
        alt: "Hero surviving with a clutch heal",
        caption: "Survive the run",
      },
    ],
    rating: "4.9",
    ratingsCount: "15K",
    ageRating: "9+",
    category: "Roguelike",
    size: "142 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "100K+",
    shortDescription: "A roguelike where your build is a dangerous spinning wheel.",
    description:
      "Add attacks, heals and risky effects to your wheel. Then time each spin under pressure. Your build can save you, betray you, or create ridiculous clutch moments.",
    whatsNew:
      "New wheel-building prototype with faster combat and stronger survival moments.",
    reviews: [
      {
        author: "Leo S.",
        rating: 5,
        title: "Stupidly tense in a good way",
        body: "Waiting for the heal segment while almost dead is exactly the kind of chaos I like.",
      },
      {
        author: "Bianca T.",
        rating: 5,
        title: "The wheel builds are the hook",
        body: "I wanted to keep adding weird pieces just to see if the run would break.",
      },
    ],
  },
};