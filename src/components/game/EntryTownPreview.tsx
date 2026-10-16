import town from "@/data/osogbo-town.json";

const featuredIds = new Set([
  "town-market",
  "civic-court",
  "community-clinic",
  "transit-park",
  "sports-ground",
  "cedar-bank",
]);

const districtFill: Record<string, string> = {
  market: "#dfc998",
  residential: "#bfcee2",
  leisure: "#a6c6a4",
  transport: "#c2cbd3",
  school: "#ddd5c8",
  outskirts: "#b8c9ae",
};

const featured = town.landmarks.filter((place) => featuredIds.has(place.id));

/** A lightweight preview drawn from the same fictional districts and places as the city map. */
export function EntryTownPreview() {
  return (
    <figure className="entry-world" aria-labelledby="entry-world-caption">
      <svg
        viewBox="0 0 1200 800"
        role="img"
        aria-labelledby="entry-world-title"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="entry-world-title">Illustrated preview of the playable Osogbo Life town</title>
        <rect width="1200" height="800" fill="#d7e3d9" />
        <path d="M0 712 Q230 640 395 728 T805 715 T1200 670 V800 H0Z" fill="#8eb5bb" />
        {town.districts.map((district) => {
          const points = district.shape.map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <g key={district.id}>
              <polygon points={points} transform="translate(4 10)" fill="#243f3b" opacity=".24" />
              <polygon
                points={points}
                fill={districtFill[district.theme] ?? "#c9d6c7"}
                stroke="#25413c"
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M370 0 Q330 250 370 390 T420 800 M730 0 Q710 250 735 390 T760 800 M0 325 Q330 312 600 325 T1200 328 M0 622 Q300 607 610 620 T1200 628"
            stroke="#83908b"
            strokeWidth="42"
          />
          <path
            d="M370 0 Q330 250 370 390 T420 800 M730 0 Q710 250 735 390 T760 800 M0 325 Q330 312 600 325 T1200 328 M0 622 Q300 607 610 620 T1200 628"
            stroke="#f0eadc"
            strokeWidth="34"
          />
          <path
            d="M370 0 Q330 250 370 390 T420 800 M730 0 Q710 250 735 390 T760 800 M0 325 Q330 312 600 325 T1200 328 M0 622 Q300 607 610 620 T1200 628"
            stroke="#b7b9a9"
            strokeWidth="2"
            strokeDasharray="12 18"
          />
        </g>
        <g fill="#497452" opacity=".9">
          <circle cx="74" cy="80" r="18" />
          <circle cx="290" cy="232" r="22" />
          <circle cx="930" cy="155" r="26" />
          <circle cx="1098" cy="505" r="21" />
          <circle cx="540" cy="512" r="25" />
          <circle cx="842" cy="700" r="24" />
        </g>
        {featured.map((place, index) => {
          const x = place.x;
          const y = place.y;
          const color = ["#d59459", "#e3ba6e", "#d1e1d7", "#d59b7b", "#e0c778", "#b7c9dc"][index];
          return (
            <g key={place.id} transform={`translate(${x} ${y})`}>
              <ellipse cy="46" rx="61" ry="17" fill="#28463d" opacity=".25" />
              <path d="M-50 -14 0 -38 50 -14 0 10Z" fill={color} stroke="#233b3a" strokeWidth="4" />
              <path
                d="M-50 -14 0 10 0 53 -50 29Z"
                fill="#ba8668"
                stroke="#233b3a"
                strokeWidth="4"
              />
              <path d="M0 10 50 -14 50 29 0 53Z" fill="#f1e4ca" stroke="#233b3a" strokeWidth="4" />
              <path d="M18 14 35 7 35 37 18 44Z" fill="#6694a2" />
              <path d="M-36 8 -18 17 -18 38 -36 29Z" fill="#355d6b" />
              <circle cx="0" cy="-47" r="6" fill="#f8d478" />
              <text x="0" y="85" textAnchor="middle" className="entry-world-label">
                {place.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption id="entry-world-caption">
        A glimpse of the fictional town you can explore.
      </figcaption>
    </figure>
  );
}
