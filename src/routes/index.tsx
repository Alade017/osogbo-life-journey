import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Car,
  GraduationCap,
  HeartHandshake,
  Map,
  MapPin,
  Store,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import cityPhoto from "@/assets/osogbo-city.jpg";
import miniatureCity from "@/assets/hero-city.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/game/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSOGBO LIFE — A Nigerian life simulation game" },
      {
        name: "description",
        content:
          "Create your character, get a job, earn virtual Naira and build a life in a miniature Osogbo-inspired city.",
      },
      { property: "og:title", content: "OSOGBO LIFE — A Nigerian life simulation game" },
      {
        property: "og:description",
        content:
          "Create your character, get a job, earn virtual Naira and build a life in a miniature Osogbo-inspired city.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { icon: Map, title: "Explore", body: "Move through nine districts inspired by Osogbo." },
  { icon: Briefcase, title: "Find your path", body: "Take jobs, learn skills and build a career." },
  { icon: Wallet, title: "Earn in-game Naira", body: "Work shifts and manage your own budget." },
  { icon: Target, title: "Make progress", body: "Complete missions and grow your character." },
];

const AREAS = [
  ["Oja Oba", "Market district"],
  ["Old Garage", "Transport hub"],
  ["Student District", "Education"],
  ["Cultural District", "Arts & heritage"],
  ["Oke-Fia", "Neighbourhood"],
  ["City Centre", "Civic life"],
];

const CAREERS = [
  ["Technology", "Web Developer · Graphic Designer"],
  ["Commerce", "Shop Assistant · Food Vendor"],
  ["Education", "Teacher"],
  ["Transport", "Delivery Rider · Professional Driver"],
  ["Creative", "Photographer"],
  ["Skilled trades", "Mechanic"],
];

const PLANNED_LIFE = [
  { icon: Building2, title: "Make a home", body: "Rent, upgrade and make a place your own." },
  { icon: Car, title: "Get around", body: "Own a vehicle and open up longer trips." },
  { icon: Store, title: "Build a business", body: "Grow a local idea into a thriving venture." },
  {
    icon: HeartHandshake,
    title: "Find your people",
    body: "Meet neighbours, make friends and join in.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="plain" size="sm">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="brick" size="sm">
            <Link to="/signup">
              Start playing <ArrowRight />
            </Link>
          </Button>
        </div>
      </header>

      <main className="pb-8">
        <section className="relative isolate flex min-h-135 items-end overflow-hidden bg-ink md:min-h-155">
          <img
            src={cityPhoto}
            alt="Panoramic view across Osogbo, Nigeria"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-r from-slate-950/80 via-slate-950/45 to-slate-950/10" />
          <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-20 text-white md:px-8 md:pb-20">
            <div className="pop-in max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/80">
                A life simulation game · Osogbo, Nigeria
              </p>
              <h1 className="mt-4 text-5xl font-bold leading-[0.98] sm:text-6xl md:text-8xl">
                OSOGBO LIFE
              </h1>
              <p className="mt-2 font-display text-xl font-semibold sm:text-2xl">
                Live Your Osogbo Story.
              </p>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90 md:text-xl">
                Build your career, make friends, explore the city and create your own Nigerian life.
                Start with ₦5,000 in-game; homes, businesses and relationships are part of the
                journey ahead.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild variant="brick" size="lg">
                  <Link to="/signup">
                    Create your character <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="plain"
                  size="lg"
                  className="border-white/60 bg-white/10 text-white hover:bg-white/20"
                >
                  <Link to="/login">Log in</Link>
                </Button>
              </div>
            </div>
          </div>
          <a
            href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 right-3 text-[10px] text-white/80 underline underline-offset-2 md:right-6"
          >
            Osogbo skyline: El-Shaddaites / CC BY-SA 4.0
          </a>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1.1fr_.9fr] md:items-center md:px-8 md:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Explore Osogbo
            </p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">A city made for your story.</h2>
            <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
              Move between familiar-feeling districts inspired by Osogbo. Discover places, build
              your routine and see where each choice takes you.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {AREAS.map(([name, detail]) => (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-bold">{name}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button asChild variant="plain" className="mt-5">
              <Link to="/signup">
                Explore the city <ArrowRight />
              </Link>
            </Button>
          </div>
          <figure className="relative overflow-hidden rounded-2xl bg-muted">
            <img
              src={miniatureCity}
              alt="Miniature Osogbo-inspired city with market streets, homes and transport"
              className="aspect-4/3 w-full object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/80 to-transparent px-4 pb-4 pt-12 text-sm font-semibold text-white">
              A miniature view of the city districts
            </figcaption>
          </figure>
        </section>

        <section className="bg-foreground py-12 text-background md:py-16">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-leaf">
              Build your life
            </p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Small steps. A bigger future.</h2>
            <div className="mt-7 grid gap-px overflow-hidden rounded-xl border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["01", "Character", "Create your identity", true],
                ["02", "Career", "Choose a job and work shifts", true],
                ["03", "Money", "Earn and manage virtual Naira", true],
                ["04", "Property", "Homes and upgrades", false],
                ["05", "Relationships", "Friends and community", false],
                ["06", "Reputation", "Grow your standing", true],
              ].map(([number, title, detail, live]) => (
                <div key={title as string} className="bg-foreground p-4">
                  <p className="font-display text-xs font-bold text-leaf">
                    {number as string} · {live ? "LIVE" : "PLANNED"}
                  </p>
                  <h3 className="mt-3 font-display text-lg font-bold">{title as string}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-background/70">
                    {detail as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Choose your path
              </p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Careers to grow into.</h2>
            </div>
            <Button asChild variant="plain">
              <Link to="/signup">
                See the jobs board <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAREERS.map(([name, roles], index) => (
              <article key={name} className="rounded-xl border border-border bg-card p-4">
                <p className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                  {String(index + 1).padStart(2, "0")} / Career path
                </p>
                <h3 className="mt-2 text-lg font-bold">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{roles}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/60 py-12 md:py-16">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-2 md:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Own your future
              </p>
              <h2 className="mt-2 text-3xl font-bold">More than a place to work.</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Homes, vehicles and player-owned businesses are planned progression systems. They
                are not available in this build yet.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {PLANNED_LIFE.slice(0, 3).map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Planned
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Meet people
              </p>
              <h2 className="mt-2 text-3xl font-bold">A city feels alive together.</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Relationships, clubs and player-to-player social features are on the roadmap. No
                social actions are shown as live until they are backed by game systems.
              </p>
              <div className="mt-5 rounded-xl border border-border bg-card p-5">
                <Users className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-bold">Community systems</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Friends · relationships · clubs · social activities
                </p>
                <span className="mt-4 inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground">
                  Planned for a future update
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Explore more
              </p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Districts with room to grow.</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Visits, jobs, missions and student courses are live. Shops, restaurants, nightlife,
                sports and festival activities are planned for later updates.
              </p>
              <Button asChild variant="plain" className="mt-4">
                <Link to="/signup">
                  Start exploring <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Store,
                  title: "Markets & commerce",
                  detail: "Oja Oba · market streets · shopping",
                  live: "Districts live; shopping planned",
                },
                {
                  icon: GraduationCap,
                  title: "Education",
                  detail: "Student District · Osun Tech Hub",
                  live: "Courses live",
                },
                {
                  icon: Map,
                  title: "Culture & recreation",
                  detail: "Arts · river · sports · festivals",
                  live: "District visits live; activities planned",
                },
                {
                  icon: CalendarDays,
                  title: "A changing city",
                  detail: "Events · weather · NPC routines",
                  live: "Planned",
                },
              ].map(({ icon: Icon, title, detail, live }) => (
                <article key={title} className="rounded-xl border border-border bg-card p-4">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-bold">{title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                  <p className="mt-3 text-[11px] font-semibold text-muted-foreground">{live}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-5 overflow-hidden rounded-2xl bg-primary text-primary-foreground md:mx-auto md:max-w-7xl">
          <div className="flex flex-col gap-5 px-6 py-9 sm:flex-row sm:items-center sm:justify-between md:px-10 md:py-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">
                Your story is yours to shape
              </p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Start your Osogbo story.</h2>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Create a character, pick a first job and take your first steps around the city.
              </p>
            </div>
            <Button
              asChild
              variant="plain"
              size="lg"
              className="shrink-0 border-white/50 bg-white text-primary hover:bg-white/90"
            >
              <Link to="/signup">
                Start your life <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">
        <p>
          OSOGBO LIFE is a fictional game inspired by Osogbo, Nigeria. In-game Naira has no cash
          value.
        </p>
        <p className="mt-1">
          Photo by{" "}
          <a
            className="underline"
            href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
            target="_blank"
            rel="noreferrer"
          >
            El-Shaddaites
          </a>
          , licensed under{" "}
          <a
            className="underline"
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
