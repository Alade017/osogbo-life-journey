import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Map, Target, Wallet } from "lucide-react";
import hero from "@/assets/hero-city.jpg";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/game/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OSOGBO LIFE — A Nigerian life simulation game" },
      { name: "description", content: "Create your character, get a job, earn virtual Naira and build a life in a miniature Osogbo-inspired city." },
      { property: "og:title", content: "OSOGBO LIFE — A Nigerian life simulation game" },
      { property: "og:description", content: "Create your character, get a job, earn virtual Naira and build a life in a miniature Osogbo-inspired city." },
    ],
  }),
  component: Landing,
});

const STEPS = [
  { icon: Map, title: "Explore the city", body: "Nine districts from Oja Oba to the Rural Outskirts.", tone: "bg-sun" },
  { icon: Briefcase, title: "Get a job", body: "Rider, vendor, teacher, developer — work your way up.", tone: "bg-primary text-primary-foreground" },
  { icon: Wallet, title: "Earn ₦ (in-game)", body: "Every shift pays virtual Naira into your wallet.", tone: "bg-clay text-clay-foreground" },
  { icon: Target, title: "Complete missions", body: "Hit milestones, level up and grow your stats.", tone: "bg-ink text-ink-foreground" },
];

function Landing() {
  return (
    <div className="studs-sand min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="plain" size="sm"><Link to="/login">Log in</Link></Button>
          <Button asChild variant="brick" size="sm"><Link to="/signup">Play free</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="grid items-center gap-8 pt-6 md:grid-cols-[1fr_1.2fr] md:pt-12">
          <div className="pop-in">
            <span className="inline-block rounded-full border-2 border-edge bg-sun px-3 py-1 text-xs font-bold">Phase 1 · Early access</span>
            <h1 className="mt-4 text-5xl font-bold leading-[0.95] md:text-7xl">
              Build your life in <span className="text-primary">Osogbo.</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-muted-foreground">
              A playful Nigerian life sim set in a miniature, toy-built city. Start with ₦5,000, find work, and climb from Level 1.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="brick" size="lg"><Link to="/signup">Create your character</Link></Button>
              <Button asChild variant="plain" size="lg"><Link to="/login">I already play</Link></Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">All money in OSOGBO LIFE is virtual in-game currency and cannot be withdrawn.</p>
          </div>
          <div className="brick overflow-hidden p-0 md:rotate-1">
            <img src={hero} alt="Toy-brick diorama of a colourful Osogbo-inspired city" width={1600} height={1008} className="h-full w-full object-cover" />
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="brick pop-in p-5" style={{ animationDelay: `${i * 80}ms` }}>
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border-2 border-edge ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t-2 border-edge/10 py-6 text-center text-xs text-muted-foreground">
        OSOGBO LIFE is a fictional, game-inspired take on Osogbo, Nigeria. Not a geographic simulation.
      </footer>
    </div>
  );
}
