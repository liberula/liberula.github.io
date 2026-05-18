import { notFound } from "next/navigation";
import MobileStorePage from "../components/MobileStorePage";
import { mobileStoreGames } from "../data/games";

type MobileStoreRouteProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return Object.keys(mobileStoreGames).map((slug) => ({
    slug,
  }));
}

export function generateMetadata({ params }: MobileStoreRouteProps) {
  const game = mobileStoreGames[params.slug];

  if (!game) {
    return {
      title: "Prototype Not Found | Liberula Games",
    };
  }

  return {
    title: `${game.title} | Liberula Games`,
    description: game.shortDescription,
  };
}

export default function Page({ params }: MobileStoreRouteProps) {
  const game = mobileStoreGames[params.slug];

  if (!game) {
    notFound();
  }

  return <MobileStorePage game={game} />;
}