import type { Location, GamePlace } from "@/lib/game";
import { cityWorldToIso, type CityWorldPosition } from "@/lib/city-world";

const MARKET_ROOFS = [
  "var(--destructive)",
  "var(--chart-4)",
  "var(--scene-sky)",
  "var(--destructive)",
  "var(--scene-sky)",
  "var(--chart-4)",
];
const HOME_ROOFS = [
  "url(#roof-rusted)",
  "var(--scene-building)",
  "var(--scene-building-edge)",
  "var(--scene-building)",
];

export function CityLocationArtwork({
  location,
  position,
  places,
}: {
  location: Location;
  position: CityWorldPosition;
  places: GamePlace[];
}) {
  const style = resolveLocationStyle(location);
  if (style === "market") return <MarketBlock position={position} places={places} />;
  if (style === "transport-compound") return <TransportCompound position={position} />;
  if (style === "danfo-park") return <DanfoPark position={position} />;
  if (style === "keke-park") return <KekePark position={position} />;
  if (style === "bike-park") return <BikePark position={position} />;
  if (style === "corporate") return <CorporateBlock position={position} />;
  if (style === "housing")
    return <HousingCluster position={position} student={location.slug === "student-district"} />;
  return <CivicBlock position={position} />;
}

function resolveLocationStyle(location: Location) {
  const metadata =
    location.metadata && typeof location.metadata === "object" && !Array.isArray(location.metadata)
      ? (location.metadata as Record<string, unknown>)
      : {};
  const override = String(
    metadata["map_architecture"] ?? metadata["transport_park_type"] ?? "",
  ).toLowerCase();
  const label =
    `${location.slug} ${location.name} ${location.type} ${location.district_type} ${override}`.toLowerCase();
  if (/oja|market|stall|bazaar/.test(label)) return "market";
  if (/keke|tricycle/.test(label)) return "keke-park";
  if (/okada|motorcycle|bike/.test(label)) return "bike-park";
  if (/transport-compound|multi.?park/.test(override) || location.slug === "old-garage")
    return "transport-compound";
  if (/transport|motor.?park|terminal|garage|danfo/.test(label)) return "danfo-park";
  if (/oke-fia|business|commercial|corporate|office/.test(label)) return "corporate";
  if (/residential|student|hostel|housing|home/.test(label)) return "housing";
  return "civic";
}

function MarketBlock({ position, places }: { position: CityWorldPosition; places: GamePlace[] }) {
  const count = 12;
  return (
    <g className="city-market-block" aria-hidden="true">
      <path
        d={lotPath(position, 2.25, 1.72)}
        fill="var(--scene-building-edge)"
        stroke="var(--scene-marking)"
        strokeWidth="1.5"
      />
      {Array.from({ length: count }, (_, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const stallPosition = {
          x: position.x + (col - 1.5) * 0.56,
          y: position.y + (row - 1) * 0.53,
        };
        const p = cityWorldToIso(stallPosition, 8 + (index % 3));
        const roof = MARKET_ROOFS[index % MARKET_ROOFS.length]!;
        return (
          <g
            key={places[index]?.id ?? `market-stall-${index}`}
            transform={`translate(${p.x} ${p.y})`}
          >
            <path d="M-8 2 0-3 8 2 0 7Z" fill="var(--scene-wood-line)" />
            <path
              d="M-8-1 0-6 8-1 0 4Z"
              fill={roof}
              stroke="var(--scene-marking)"
              strokeWidth=".7"
            />
            <path
              d="M-5 0v4 M0-2v5 M5 0v3"
              stroke="var(--brand-cream)"
              strokeOpacity=".55"
              strokeWidth=".7"
            />
            <path d="M-7 3 0 7 7 3" fill="none" stroke="var(--brand-ink)" strokeWidth=".8" />
          </g>
        );
      })}
      <path
        d={lotPath(position, 2.25, 1.72)}
        fill="none"
        stroke="var(--scene-marking)"
        strokeOpacity=".36"
        strokeDasharray="3 4"
      />
    </g>
  );
}

function TransportCompound({ position }: { position: CityWorldPosition }) {
  return (
    <g className="city-transport-compound" aria-hidden="true">
      <path
        d={lotPath(position, 2.45, 1.82)}
        fill="var(--scene-road)"
        stroke="var(--chart-4)"
        strokeWidth="1.8"
      />
      <path
        d={lotPath(position, 2.22, 1.6)}
        fill="var(--scene-road)"
        stroke="var(--brand-slate)"
        strokeWidth=".8"
      />
      <path
        d={parkingBay(position, -0.9, -0.15, -0.45, 0.6)}
        fill="none"
        stroke="var(--scene-marking)"
        strokeOpacity=".72"
        strokeWidth="1"
      />
      <path
        d={parkingBay(position, 0.35, -0.1, 0.55, 0.65)}
        fill="none"
        stroke="var(--scene-marking)"
        strokeOpacity=".72"
        strokeWidth="1"
      />
      <g className="city-park-zone city-park-zone--danfo">
        <path
          d={lotPath({ x: position.x - 0.65, y: position.y - 0.1 }, 1.08, 0.72)}
          fill="var(--scene-road)"
          stroke="var(--chart-4)"
          strokeWidth="1"
        />
        {[
          [-0.33, -0.25],
          [0.28, -0.12],
          [-0.13, 0.3],
        ].map(([dx, dy], i) => (
          <MiniDanfo
            key={i}
            position={{ x: position.x - 0.65 + dx!, y: position.y - 0.1 + dy! }}
            angle={[-24, 11, 28][i]!}
          />
        ))}
      </g>
      <g className="city-park-zone city-park-zone--keke">
        <path
          d={lotPath({ x: position.x + 0.9, y: position.y - 0.25 }, 0.82, 0.62)}
          fill="var(--scene-hill-front)"
          stroke="var(--scene-hill)"
          strokeWidth="1"
        />
        {[
          [-0.18, -0.16],
          [0.16, 0.17],
        ].map(([dx, dy], i) => (
          <MiniKeke
            key={i}
            position={{ x: position.x + 0.9 + dx!, y: position.y - 0.25 + dy! }}
            angle={i ? 18 : -13}
          />
        ))}
      </g>
      <g className="city-park-zone city-park-zone--bike">
        <path
          d={lotPath({ x: position.x + 0.15, y: position.y + 0.8 }, 0.84, 0.42)}
          fill="var(--scene-road)"
          stroke="var(--scene-sky)"
          strokeWidth="1"
        />
        {[
          [-0.23, 0],
          [0.02, 0.12],
          [0.25, -0.06],
        ].map(([dx, dy], i) => (
          <MiniBike key={i} position={{ x: position.x + 0.15 + dx!, y: position.y + 0.8 + dy! }} />
        ))}
      </g>
      <path
        d={lotPath(position, 2.45, 1.82)}
        fill="none"
        stroke="var(--scene-building-edge)"
        strokeOpacity=".35"
        strokeDasharray="5 5"
      />
    </g>
  );
}

function DanfoPark({ position }: { position: CityWorldPosition }) {
  return (
    <g aria-hidden="true">
      <path
        d={lotPath(position, 1.8, 1.2)}
        fill="var(--scene-road)"
        stroke="var(--chart-4)"
        strokeWidth="1.5"
      />
      {[
        [-0.65, -0.35],
        [0, -0.1],
        [0.55, 0.22],
      ].map(([dx, dy], i) => (
        <MiniDanfo
          key={i}
          position={{ x: position.x + dx!, y: position.y + dy! }}
          angle={i * 17 - 18}
        />
      ))}
    </g>
  );
}

function KekePark({ position }: { position: CityWorldPosition }) {
  return (
    <g aria-hidden="true">
      <path
        d={lotPath(position, 1.5, 1)}
        fill="var(--scene-road)"
        stroke="var(--scene-hill)"
        strokeWidth="1.5"
      />
      {[
        [-0.35, -0.18],
        [0.3, 0.18],
      ].map(([dx, dy], i) => (
        <MiniKeke
          key={i}
          position={{ x: position.x + dx!, y: position.y + dy! }}
          angle={i ? 18 : -14}
        />
      ))}
    </g>
  );
}

function BikePark({ position }: { position: CityWorldPosition }) {
  return (
    <g aria-hidden="true">
      <path
        d={lotPath(position, 1.35, 0.8)}
        fill="var(--scene-road)"
        stroke="var(--scene-sky)"
        strokeWidth="1.5"
      />
      {[
        [-0.32, -0.05],
        [0.05, 0.12],
        [0.34, -0.12],
      ].map(([dx, dy], i) => (
        <MiniBike key={i} position={{ x: position.x + dx!, y: position.y + dy! }} />
      ))}
    </g>
  );
}

function MiniDanfo({ position, angle }: { position: CityWorldPosition; angle: number }) {
  const p = cityWorldToIso(position, 4);
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${angle})`}>
      <ellipse cy="4" rx="9" ry="4" fill="var(--brand-ink)" opacity=".6" />
      <rect
        x="-9"
        y="-4"
        width="18"
        height="9"
        rx="2"
        fill="var(--chart-4)"
        stroke="var(--brand-ink)"
        strokeWidth=".9"
      />
      <rect x="-6" y="-3" width="4" height="3" fill="var(--scene-sky)" />
      <rect x="1" y="-3" width="5" height="3" fill="var(--scene-sky)" />
      <rect x="-8" y="3" width="16" height="2" fill="var(--success)" />
      <circle cx="-6" cy="5" r="1.5" fill="var(--brand-ink)" />
      <circle cx="6" cy="5" r="1.5" fill="var(--brand-ink)" />
    </g>
  );
}

function MiniKeke({ position, angle }: { position: CityWorldPosition; angle: number }) {
  const p = cityWorldToIso(position, 3);
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${angle})`}>
      <ellipse cy="4" rx="7" ry="3" fill="var(--brand-ink)" opacity=".55" />
      <path d="M-6-3h8l4 4H-6Z" fill="var(--chart-4)" stroke="var(--brand-ink)" strokeWidth=".8" />
      <path d="M-3-3v-3h5v3" fill="var(--scene-hill)" />
      <circle cx="-4" cy="2" r="1.5" fill="var(--brand-ink)" />
      <circle cx="4" cy="2" r="1.5" fill="var(--brand-ink)" />
    </g>
  );
}

function MiniBike({ position }: { position: CityWorldPosition }) {
  const p = cityWorldToIso(position, 2);
  return (
    <g
      transform={`translate(${p.x} ${p.y})`}
      fill="none"
      stroke="var(--brand-ink)"
      strokeWidth="1.5"
    >
      <circle cx="-5" cy="2" r="3" />
      <circle cx="5" cy="2" r="3" />
      <path d="m-5 2 4-5 3 5-7 0 4-5 5 0" stroke="var(--chart-4)" />
      <path d="M1-3h3M-2-4h-3" stroke="var(--scene-building-edge)" />
    </g>
  );
}

function CorporateBlock({ position }: { position: CityWorldPosition }) {
  return (
    <g className="city-corporate-block" aria-hidden="true">
      {[
        { dx: -0.55, dy: -0.22, h: 34, w: 17, tone: "var(--scene-sky)" },
        { dx: 0.25, dy: -0.05, h: 48, w: 18, tone: "var(--scene-sky)" },
        { dx: 0.85, dy: 0.42, h: 28, w: 13, tone: "var(--scene-hill-front)" },
      ].map((building, index) => {
        const base = cityWorldToIso({ x: position.x + building.dx, y: position.y + building.dy });
        const x = base.x;
        const y = base.y;
        const half = building.w / 2;
        const height = building.h;
        return (
          <g key={index}>
            <path
              d={`M${x - half} ${y - height} l${half} -7 ${half} 7 v${height} l-${half} 7Z`}
              fill="var(--brand-ink)"
              stroke="var(--scene-sky)"
              strokeOpacity=".6"
            />
            <path
              d={`M${x} ${y - height - 7} l${half} 7 v${height} l-${half} -7Z`}
              fill="var(--scene-hill-front)"
              stroke="var(--scene-sky)"
              strokeOpacity=".55"
            />
            <path
              d={`M${x - half} ${y - height} l${half} -7 ${half} 7 -${half} 7Z`}
              fill="var(--scene-sky)"
              stroke="var(--scene-marking)"
              strokeOpacity=".7"
            />
            {Array.from({ length: Math.floor(height / 8) }, (_, row) =>
              Array.from({ length: 2 }, (_, col) => (
                <path
                  key={`${row}-${col}`}
                  d={`M${x - half + 3 + col * 6} ${y - height + 5 + row * 8} v4`}
                  stroke={row % 2 ? "var(--scene-sky)" : "var(--chart-4)"}
                  strokeWidth="2.3"
                  strokeOpacity=".88"
                />
              )),
            )}
          </g>
        );
      })}
    </g>
  );
}

function HousingCluster({ position, student }: { position: CityWorldPosition; student: boolean }) {
  const count = student ? 5 : 4;
  return (
    <g className="city-housing-cluster" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const dx = ((index % 3) - 1) * 0.47;
        const dy = (Math.floor(index / 3) - 0.5) * 0.5;
        const p = cityWorldToIso({ x: position.x + dx, y: position.y + dy }, 9 + (index % 2) * 3);
        const roof = HOME_ROOFS[index % HOME_ROOFS.length]!;
        return (
          <g key={index}>
            <path
              d={`M${p.x - 10} ${p.y + 2} v11 l10 6 10-6 V${p.y + 2} l-10 6Z`}
              fill="var(--scene-building-edge)"
            />
            <path d={`M${p.x} ${p.y + 8} l10-6 v11 l-10 6Z`} fill="var(--scene-wood-line)" />
            <path d={`M${p.x - 10} ${p.y + 2} l10-7 10 7-10 6Z`} fill={roof} />
            <path d={`M${p.x - 2} ${p.y + 7} v6 l4 2 V9Z`} fill="var(--chart-4)" />
            <path
              d={`M${p.x - 8} ${p.y + 1}v3 M${p.x - 5} ${p.y - 1}v4 M${p.x - 2} ${p.y - 3}v4`}
              stroke="var(--scene-building-edge)"
              strokeWidth=".65"
              opacity=".7"
            />
          </g>
        );
      })}
    </g>
  );
}

function CivicBlock({ position }: { position: CityWorldPosition }) {
  const p = cityWorldToIso(position, 15);
  return (
    <g aria-hidden="true">
      <path d={`M${p.x - 18} ${p.y}v19l18 11 18-11V${p.y}l-18 11Z`} fill="var(--scene-road)" />
      <path d={`M${p.x} ${p.y + 11}l18-11v19L${p.x} ${p.y + 30}Z`} fill="var(--scene-wood-line)" />
      <path d={`M${p.x - 18} ${p.y}l18-12 18 12-18 11Z`} fill="var(--scene-building)" />
      <path d={`M${p.x - 4} ${p.y + 8}v8l6 4v-8Z`} fill="var(--chart-4)" />
    </g>
  );
}

function lotPath(position: CityWorldPosition, radiusX: number, radiusY: number) {
  const points = [
    cityWorldToIso({ x: position.x, y: position.y - radiusY }),
    cityWorldToIso({ x: position.x + radiusX, y: position.y }),
    cityWorldToIso({ x: position.x, y: position.y + radiusY }),
    cityWorldToIso({ x: position.x - radiusX, y: position.y }),
  ];
  return `M${points.map((point) => `${point.x} ${point.y}`).join("L")}Z`;
}

function parkingBay(position: CityWorldPosition, x1: number, y1: number, x2: number, y2: number) {
  const a = cityWorldToIso({ x: position.x + x1, y: position.y + y1 });
  const b = cityWorldToIso({ x: position.x + x2, y: position.y + y2 });
  return `M${a.x} ${a.y}L${b.x} ${b.y}`;
}
