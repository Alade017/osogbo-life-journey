import { createRoot } from "react-dom/client";
import cityImage from "../src/assets/hero-city.jpg";
import characterImage from "../src/assets/osogbo-city.jpg";
import "./style.css";

const gameUrl = (import.meta.env["VITE_GAME_URL"] || "http://127.0.0.1:3000").replace(/\/$/, "");

function PublicWebsite() {
  return (
    <>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="Osogbo Life home">
          OSOGBO <span>LIFE</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#city">The city</a>
          <a href="#how-to-play">How to play</a>
          <a className="nav-login" href={`${gameUrl}/login`}>
            Log in
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <img
            className="hero-art"
            src={cityImage}
            alt="A small, hand-built Osogbo-inspired city"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow">A life simulation inspired by Osogbo, Nigeria</p>
            <h1 id="hero-title">
              A new day.
              <br />
              Your own <em>Osogbo story.</em>
            </h1>
            <p className="hero-copy">
              Walk the neighbourhood, find work, meet the people around you, and make a home in a
              city shaped by everyday life.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={`${gameUrl}/`}>
                Play now <span aria-hidden="true">→</span>
              </a>
              <a className="button button-secondary" href={`${gameUrl}/signup`}>
                Create an account
              </a>
            </div>
            <p className="availability">
              <span aria-hidden="true" /> Playable life simulation · Online account saves ·
              Multiplayer is in development
            </p>
          </div>
          <a
            className="photo-credit"
            href="https://commons.wikimedia.org/wiki/File:Osogbo.jpg"
            target="_blank"
            rel="noreferrer"
          >
            Osogbo skyline · El-Shaddaites · CC BY-SA 4.0
          </a>
        </section>

        <section id="city" className="city-section">
          <div className="section-heading">
            <p className="eyebrow eyebrow-dark">A place to make your own</p>
            <h2>Small moments make a life.</h2>
            <p>Start with a character and a neighbourhood. Decide where the day takes you.</p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-number">01</span>
              <h3>Find your way</h3>
              <p>
                Explore a fictional Osogbo-inspired city, visit local destinations, and make your
                way home.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-number">02</span>
              <h3>Build a working life</h3>
              <p>
                Discover jobs, work shifts, and grow your character through server-validated
                progress.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-number">03</span>
              <h3>Settle in</h3>
              <p>
                Arrange your home, tend to daily needs, and shape a routine that feels like yours.
              </p>
            </article>
          </div>
          <figure className="city-preview">
            <img
              src={characterImage}
              alt="Osogbo, Nigeria, the inspiration for the game's fictional setting"
              loading="lazy"
            />
            <figcaption>
              <span>OSOGBO LIFE</span>
              <span>A fictional city inspired by real places and everyday stories.</span>
            </figcaption>
          </figure>
        </section>

        <section id="how-to-play" className="start-section">
          <div>
            <p className="eyebrow">Your story starts here</p>
            <h2>Make a little room for a new life.</h2>
            <p>
              Create an account, design your character, and step into the neighbourhood. Your game
              progress is tied to your account.
            </p>
          </div>
          <a className="button button-light" href={`${gameUrl}/signup`}>
            Start your life <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <a href="#top" className="brand">
          OSOGBO <span>LIFE</span>
        </a>
        <p>A fictional Nigerian life simulation. In-game currency is simulated.</p>
        <a href={`${gameUrl}/login`}>Account &amp; settings</a>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<PublicWebsite />);
