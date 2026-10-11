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
          OSOGBO <span>LIFE: BEGINNINGS</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#features">The experience</a>
          <a href="#how-to-play">How to play</a>
          <a href="#questions">FAQ</a>
          <a className="nav-login" href={`${gameUrl}/login`}>
            Log in
          </a>
          <a className="nav-join" href={`${gameUrl}/signup`}>
            Create account
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
            <p className="eyebrow">OSOGBO LIFE: BEGINNINGS - Inspired by Osogbo, Nigeria</p>
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

        <section id="features" className="city-section">
          <div className="section-heading">
            <p className="eyebrow eyebrow-dark">A city life, at your pace</p>
            <h2>Small moments make a life.</h2>
            <p>
              Create a character, explore a shared neighbourhood, find work, meet other players,
              and make a home in a fictional city inspired by Osogbo.
            </p>
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
                Shape your character, arrange your home, and build a routine that feels like yours.
              </p>
            </article>
            <article className="feature-card">
              <span className="feature-number">04</span>
              <h3>Meet real players</h3>
              <p>Find players in the city, send friend requests, and chat in supported areas.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">05</span>
              <h3>Make progress</h3>
              <p>Work shifts, build skills, follow missions, and earn simulated in-game Naira.</p>
            </article>
            <article className="feature-card">
              <span className="feature-number">06</span>
              <h3>Explore your city</h3>
              <p>Travel between districts, discover useful places, and return to your saved home.</p>
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

        <section className="life-preview" aria-labelledby="life-preview-title">
          <div className="life-preview-copy">
            <p className="eyebrow eyebrow-dark">Your character. Your choices.</p>
            <h2 id="life-preview-title">Build a life one day at a time.</h2>
            <p>
              Your story begins with a character and a place in the neighbourhood. Explore the
              city, take a shift, grow your skills, and make your home your own.
            </p>
            <a className="text-link" href={`${gameUrl}/signup`}>
              Create your character <span aria-hidden="true">&gt;</span>
            </a>
          </div>
          <div className="life-preview-cards" aria-label="Game features">
            <article><span aria-hidden="true">HOME</span><strong>A place to call home</strong><small>Arrange rooms and furniture in your saved home.</small></article>
            <article><span aria-hidden="true">WORK</span><strong>Work and grow</strong><small>Take shifts and develop your character.</small></article>
            <article><span aria-hidden="true">PEOPLE</span><strong>People around you</strong><small>Meet players and build friendships.</small></article>
          </div>
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

        <section id="questions" className="faq-section" aria-labelledby="faq-title">
          <div className="section-heading">
            <p className="eyebrow eyebrow-dark">A few things to know</p>
            <h2 id="faq-title">Questions, answered.</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>What is OSOGBO LIFE: BEGINNINGS?</summary>
              <p>
                It is an online life simulation set in a fictional city inspired by Osogbo, Nigeria.
                Create a character, explore, work, meet players, and shape a home.
              </p>
            </details>
            <details>
              <summary>Is the in-game money real?</summary>
              <p>No. Naira shown in the game is simulated currency and has no real-world value.</p>
            </details>
            <details>
              <summary>Can I play on a phone?</summary>
              <p>The game includes responsive screens and touch movement controls for mobile browsers.</p>
            </details>
            <details>
              <summary>How do I meet and message another player?</summary>
              <p>
                Open People to find player profiles and send a friend request. Once accepted, you can
                start a private conversation; area chat is available to players in the same area.
              </p>
            </details>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a href="#top" className="brand">
          OSOGBO <span>LIFE: BEGINNINGS</span>
        </a>
        <p>A fictional Nigerian life simulation. In-game currency is simulated.</p>
        <div className="footer-links">
          <a href="#questions">FAQ</a>
          <a href={`${gameUrl}/login`}>Log in</a>
          <a href={`${gameUrl}/signup`}>Create account</a>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<PublicWebsite />);
