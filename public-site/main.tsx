import { createRoot } from "react-dom/client";
import "./style.css";
const gameUrl = import.meta.env["VITE_GAME_URL"] || "http://127.0.0.1:3000";
export function PublicWebsite() {
  return (
    <>
      <header>
        <a href="/" className="brand">
          OSOGBO <span>LIFE</span>
        </a>
        <nav>
          <a href="#how-to-play">How to play</a>
          <a href={`${gameUrl}/login`}>Log in</a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <p className="eyebrow">A CITY FULL OF POSSIBILITIES</p>
          <h1>
            A new day.
            <br />
            Your own <em>Osogbo story.</em>
          </h1>
          <p>
            Step onto the street. Find honest work, meet your neighbours, and turn a small room into
            a place that feels like home.
          </p>
          <a className="play" href={`${gameUrl}/map`}>
            Play Osogbo Life →
          </a>
          <a className="signup" href={`${gameUrl}/signup`}>
            Start a new life
          </a>
          <div className="street" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <span />
          </div>
        </section>
        <section id="how-to-play" className="steps">
          <article>
            <span>01 / EXPLORE</span>
            <h2>Know your quarter</h2>
            <p>Walk the neighbourhood, visit useful buildings and meet the people around you.</p>
          </article>
          <article>
            <span>02 / GROW</span>
            <h2>Make your first shift</h2>
            <p>Find work, earn game naira, and decide what matters to your character.</p>
          </article>
          <article>
            <span>03 / BELONG</span>
            <h2>Build a home</h2>
            <p>Rest, recover and arrange a space that reflects the life you’re creating.</p>
          </article>
        </section>
      </main>
      <footer>
        <strong>OSOGBO LIFE</strong>
        <p>A fictional single-player life simulation. Your progress is saved to your account.</p>
        <a href={`${gameUrl}/login`}>Continue your story →</a>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<PublicWebsite />);
