import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, Compass, House, MapPin, Wallet } from "lucide-react";
import { Avatar, type Appearance } from "@/components/game/Avatar";
import { EntryTownPreview } from "@/components/game/EntryTownPreview";
import { Logo } from "@/components/game/Logo";
import { Button } from "@/components/ui/button";
import { formatNaira, q } from "@/lib/game";
import "@/components/game/game-entry.css";

export const Route = createFileRoute("/_authenticated/enter")({
  head: () => ({
    meta: [
      { title: "Enter Osogbo — OSOGBO LIFE" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Return to your saved OSOGBO LIFE journey." },
    ],
  }),
  component: GameEntry,
});

function GameEntry() {
  const navigate = useNavigate();
  const characterQuery = useQuery(q.character());
  const character = characterQuery.data;
  const walletQuery = useQuery({ ...q.wallet(), enabled: !!character });
  const locationsQuery = useQuery({ ...q.locations(), enabled: !!character });
  const location = locationsQuery.data?.find(
    (place) => place.id === character?.current_location_id,
  );
  const hasSavedProgress = Boolean(
    character && (character.xp > 0 || character.game_day > 1 || character.level > 1),
  );

  useEffect(() => {
    if (!characterQuery.isPending && !characterQuery.isError && !character) {
      void navigate({ to: "/create-character", replace: true });
    }
  }, [character, characterQuery.isError, characterQuery.isPending, navigate]);

  return (
    <main className="game-entry">
      <header className="game-entry-header">
        <Link to="/" aria-label="OSOGBO LIFE public home">
          <Logo />
        </Link>
        <span className="game-entry-header-note">Your city is waiting</span>
      </header>
      <div className="game-entry-layout">
        <section className="game-entry-copy" aria-labelledby="game-entry-title">
          <span className="game-entry-eyebrow">
            <span aria-hidden="true" /> A life to make your own
          </span>
          <h1 id="game-entry-title">
            Every day begins somewhere. <em>Yours begins here.</em>
          </h1>
          <p className="game-entry-intro">
            Explore a fictional Osogbo-inspired town. Find work, make a home, meet people, and shape
            your next chapter one choice at a time.
          </p>

          {characterQuery.isPending ? (
            <p className="game-entry-state" role="status">
              Finding your saved journey…
            </p>
          ) : characterQuery.isError ? (
            <div className="game-entry-state" role="alert">
              <p>Your journey could not be loaded. Try again.</p>
              <Button onClick={() => void characterQuery.refetch()}>Retry</Button>
            </div>
          ) : character ? (
            <>
              <div className="game-entry-player">
                <span className="game-entry-avatar" aria-hidden="true">
                  <Avatar
                    appearance={(character.appearance as Appearance | null) ?? {}}
                    gender={character.gender}
                    size={56}
                  />
                </span>
                <span>
                  <small>Welcome back</small>
                  <strong>{character.name}</strong>
                  <small>
                    Level {character.level}
                    {location ? ` · ${location.name}` : ""}
                  </small>
                </span>
                {walletQuery.data && (
                  <span className="game-entry-wallet">
                    <Wallet size={16} aria-hidden="true" /> {formatNaira(walletQuery.data.balance)}
                  </span>
                )}
              </div>
              <Button asChild size="lg" className="game-entry-cta">
                <Link to="/home" search={{ visit: undefined }}>
                  {hasSavedProgress ? "Continue your journey" : "Enter Osogbo"}{" "}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </>
          ) : null}
          <p className="game-entry-note">Money and prices are part of the game.</p>
          <ul className="game-entry-activities" aria-label="Things to do in Osogbo Life">
            <li>
              <Compass aria-hidden="true" /> Explore the city
            </li>
            <li>
              <BriefcaseBusiness aria-hidden="true" /> Find your next job
            </li>
            <li>
              <House aria-hidden="true" /> Make a home
            </li>
          </ul>
        </section>
        <div className="game-entry-art">
          <div className="game-entry-art-top">
            <span>
              <MapPin size={15} aria-hidden="true" /> Your world awaits
            </span>
            <span>OSOGBO LIFE / BEGINNINGS</span>
          </div>
          <EntryTownPreview />
          {character && (
            <div className="game-entry-character" aria-hidden="true">
              <Avatar
                appearance={(character.appearance as Appearance | null) ?? {}}
                gender={character.gender}
                size={174}
              />
            </div>
          )}
          <span className="game-entry-art-caption">Explore • Work • Grow</span>
        </div>
      </div>
      <footer className="game-entry-footer">
        A fictional Osogbo-inspired life simulation <span>Built for your story</span>
      </footer>
    </main>
  );
}
