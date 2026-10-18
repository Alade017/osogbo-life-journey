import { useState } from "react";
import { BookOpen, Store } from "lucide-react";

export type CourseAndStallApp = "Courses" | "Market Stalls";

const courses = [
  ["Phone repair basics", "Osun Tech Hub", "3 weeks", "Service"],
  ["Fashion and tailoring", "Aro Craft School", "6 weeks", "Design"],
  ["Catering essentials", "Iya Mufu Kitchen", "4 weeks", "Hospitality"],
  ["Digital marketing", "Osun Tech Hub", "5 weeks", "Sales"],
  ["Solar installation", "Community Polytechnic", "8 weeks", "Technical"],
] as const;

const npcStalls = [
  ["Aunty Bisi Fabrics", "Adire and Ankara", "Open", "14 visitors"],
  ["Sabo Fruit Corner", "Fresh fruit and juice", "Open", "9 visitors"],
  ["Tunde Phone Care", "Repairs and accessories", "Busy", "18 visitors"],
] as const;

export function CourseAndStallApps({ app }: { app: CourseAndStallApp }) {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [stallName, setStallName] = useState("My neighbourhood stall");
  const [stallGoods, setStallGoods] = useState("Snacks and drinks");
  const [stallOpen, setStallOpen] = useState(false);

  if (app === "Courses")
    return (
      <div className="phone-local-app" aria-label="Courses preview">
        <header>
          <BookOpen aria-hidden="true" />
          <span>
            <strong>Courses and skills</strong>
            <small>Local preview - enrollment is not saved</small>
          </span>
        </header>
        <div className="phone-local-list">
          {courses.map(([name, provider, duration, skill]) => (
            <div className="phone-local-card" key={name}>
              <div>
                <strong>{name}</strong>
                <small>
                  {provider} · {duration}
                </small>
                <b>{skill} skill</b>
              </div>
              <button
                type="button"
                aria-pressed={selectedCourse === name}
                onClick={() => setSelectedCourse(name)}
              >
                {selectedCourse === name ? "Selected" : "View"}
              </button>
            </div>
          ))}
        </div>
        <small className="phone-local-note">
          Choose a course to plan your next skill. Game progress is unchanged.
        </small>
      </div>
    );

  return (
    <div className="phone-local-app" aria-label="Market stalls">
      <header>
        <Store aria-hidden="true" />
        <span>
          <strong>Oja-Oba market stalls</strong>
          <small>NPC stalls and your local stall builder</small>
        </span>
      </header>
      <div className="phone-local-tabs">
        <button type="button" aria-pressed="true">
          Browse stalls
        </button>
        <button type="button">Build yours</button>
      </div>
      <div className="phone-local-list">
        {npcStalls.map(([name, goods, status, visitors]) => (
          <div className="phone-local-card" key={name}>
            <div>
              <strong>{name}</strong>
              <small>{goods}</small>
              <b>
                {status} · {visitors}
              </b>
            </div>
            <Store aria-hidden="true" />
          </div>
        ))}
      </div>
      <section className="phone-stall-builder" aria-label="Your stall builder">
        <strong>Build your stall</strong>
        <label className="phone-local-field">
          Stall name
          <input value={stallName} onChange={(event) => setStallName(event.target.value)} />
        </label>
        <label className="phone-local-field">
          Goods or service
          <input value={stallGoods} onChange={(event) => setStallGoods(event.target.value)} />
        </label>
        <div className="phone-local-card">
          <div>
            <strong>{stallName || "Your stall"}</strong>
            <small>{stallGoods || "Add your goods"}</small>
            <b>{stallOpen ? "Open for preview" : "Closed"}</b>
          </div>
        </div>
        <button
          type="button"
          className="phone-local-action"
          onClick={() => setStallOpen((open) => !open)}
        >
          {stallOpen ? "Close preview stall" : "Open preview stall"}
        </button>
        <small className="phone-local-note">
          This builder is local only; it does not create ownership, goods, or earnings.
        </small>
      </section>
    </div>
  );
}
