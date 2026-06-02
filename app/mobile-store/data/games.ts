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

  "spinfall": {
    slug: "spinfall",
    title: "Spinfall",
    subtitle: "Build the wheel. Time the spin. Survive the run.",
    developer: "Liberula Games",
    icon: "/mobile-store/spinfall/icon.png",
    heroScreenshot: {
      src: "/mobile-store/spinfall/hero.png",
      alt: "A hero almost dying while a roulette wheel spins",
      caption: "Everything on the line",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/spinfall/step-1.png",
        alt: "Player choosing roulette wheel segments",
        caption: "Build your wheel",
      },
      {
        src: "/mobile-store/spinfall/step-2.png",
        alt: "The wheel spinning during combat",
        caption: "Time it right",
      },
      {
        src: "/mobile-store/spinfall/step-3.png",
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
        author: "Ryan K.",
        rating: 5,
        title: "that heal lol",
        body: "thought i was dead"
      },
      {
        author: "Sarah P.",
        rating: 5,
        title: "addictive",
        body: "the wheel is way more stressful than it looks"
      }
    ],
  },
  "spin-kingdom": {
    slug: "spin-kingdom",
    title: "Spin Kingdom",
    subtitle: "Spin the wheel. Gather resources. Grow your empire.",
    developer: "Liberula Games",
    icon: "/mobile-store/spin-kingdom/icon.png",
    heroScreenshot: {
      src: "/mobile-store/spin-kingdom/hero.png",
      alt: "A growing kingdom powered by a giant resource wheel",
      caption: "Build your empire",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/spin-kingdom/step-1.png",
        alt: "Player spinning a wheel showing resource rewards",
        caption: "Spin the wheel",
      },
      {
        src: "/mobile-store/spin-kingdom/step-2.png",
        alt: "Resources being generated by farms and buildings",
        caption: "Gather resources",
      },
    ],
    rating: "4.8",
    ratingsCount: "11K",
    ageRating: "9+",
    category: "Strategy",
    size: "135 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "100K+",
    shortDescription:
      "A kingdom builder where every spin shapes your future.",
    description:
      "Spin the wheel to collect resources, build structures, unlock territory and keep your growing kingdom alive. Every decision changes how your empire develops.",
    whatsNew:
      "New prototype build with improved wheel rewards and kingdom expansion.",
    reviews: [
      {
        author: "Lucas R.",
        rating: 5,
        title: "Simple but hard to stop",
        body: "Every spin creates a new decision about what to build next.",
      },
      {
        author: "Patricia M.",
        rating: 5,
        title: "Love the expansion",
        body: "Watching the kingdom grow from a few tiles into a huge settlement feels great.",
      },
    ],
  },
  "truck-simulator": {
    slug: "truck-simulator",
    title: "Trash Truck Simulator",
    subtitle: "Collect trash. Unlock new neighborhoods. Keep the city clean.",
    developer: "Liberula Games",
    icon: "/mobile-store/truck-simulator/icon.png",
    heroScreenshot: {
      src: "/mobile-store/truck-simulator/hero.png",
      alt: "A garbage truck collecting trash on a city street",
      caption: "Keep the city clean",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/truck-simulator/step-1.png",
        alt: "Truck approaching a row of trash bins",
        caption: "Drive the truck",
      },
      {
        src: "/mobile-store/truck-simulator/step-2.png",
        alt: "Player aligning the truck with a trash bin",
        caption: "Collect trash",
      }
    ],
    rating: "4.7",
    ratingsCount: "9K",
    ageRating: "4+",
    category: "Simulation",
    size: "118 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "50K+",
    shortDescription:
      "Drive a garbage truck and clean the city one street at a time.",
    description:
      "Collect trash, master truck positioning, complete routes and unlock larger neighborhoods. A satisfying simulation about keeping a city clean.",
    whatsNew:
      "New collection routes, cleaner city progression and improved truck controls.",
    reviews: [
      {
        author: "Carlos F.",
        rating: 5,
        title: "Oddly satisfying",
        body: "Lining up the truck perfectly and clearing a street feels great.",
      },
      {
        author: "Amanda S.",
        rating: 4,
        title: "Relaxing simulator",
        body: "I liked seeing new districts open up as I cleaned the city.",
      },
    ],
  },
  "garbage-tycoon": {
    slug: "garbage-tycoon",
    title: "Garbage Tycoon",
    subtitle: "Process waste. Build recycling chains. Grow your business.",
    developer: "Liberula Games",
    icon: "/mobile-store/garbage-tycoon/icon.png",
    heroScreenshot: {
      src: "/mobile-store/garbage-tycoon/hero.png",
      alt: "A large recycling operation processing mountains of trash",
      caption: "Turn waste into profit",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/garbage-tycoon/step-1.png",
        alt: "Garbage trucks delivering waste",
        caption: "Collect waste",
      },
      {
        src: "/mobile-store/garbage-tycoon/step-2.png",
        alt: "Different recycling facilities processing materials",
        caption: "Recycle materials",
      }
    ],
    rating: "4.8",
    ratingsCount: "14K",
    ageRating: "4+",
    category: "Tycoon",
    size: "126 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "100K+",
    shortDescription:
      "Build a recycling empire from a growing mountain of trash.",
    description:
      "Manage trucks, process waste, unlock specialized recycling plants and turn garbage into profit. Expand your facilities and optimize the entire operation.",
    whatsNew:
      "New recycling facilities and improved production balancing.",
    reviews: [
      {
        author: "Fernando L.",
        rating: 5,
        title: "Much deeper than expected",
        body: "I started trying to optimize the whole recycling chain.",
      },
      {
        author: "Julia C.",
        rating: 5,
        title: "Love the progression",
        body: "Every new facility changes how the operation works.",
      },
    ],
  },
  "vacuum-truck": {
    slug: "vacuum-truck",
    title: "Vacuum Truck",
    subtitle: "Clean the wasteland. Restore the world. Bring humanity back.",
    developer: "Liberula Games",
    icon: "/mobile-store/vacuum-truck/icon.png",
    heroScreenshot: {
      src: "/mobile-store/vacuum-truck/hero.png",
      alt: "A giant vacuum truck cleaning a polluted abandoned city",
      caption: "Restore the world",
    },
    gameplaySteps: [
      {
        src: "/mobile-store/vacuum-truck/step-1.png",
        alt: "Vacuum truck approaching a polluted area",
        caption: "Clean the wasteland",
      },
      {
        src: "/mobile-store/vacuum-truck/step-2.png",
        alt: "Pollution disappearing as the truck works",
        caption: "Restore nature",
      }
    ],
    rating: "4.9",
    ratingsCount: "18K",
    ageRating: "4+",
    category: "Simulation",
    size: "132 MB",
    price: "Free",
    hasInAppPurchases: true,
    installs: "250K+",
    shortDescription:
      "A satisfying cleanup game about restoring a ruined Earth.",
    description:
      "Drive a powerful vacuum truck across abandoned regions, remove decades of pollution and prepare the world for humanity's return. Every area you clean transforms before your eyes.",
    whatsNew:
      "New restoration effects, cleaner progression and larger wasteland zones.",
    reviews: [
      {
        author: "Marina P.",
        rating: 5,
        title: "Super satisfying",
        body: "Watching dirty areas become green again never gets old.",
      },
      {
        author: "Diego V.",
        rating: 5,
        title: "Wall-E vibes",
        body: "The world restoration fantasy is surprisingly motivating.",
      },
    ],
  }
};