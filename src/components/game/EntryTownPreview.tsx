import { useMemo } from "react";
import {
  cellCentre,
  previewDistricts,
  previewLandmarks,
  previewTiles,
  previewViewBox,
  type PreviewCell,
} from "@/components/game/entry-town-preview";

const tiles = previewTiles();
const districts = previewDistricts();

type Props = {
  /** Returning player's last location, as a grid cell. Null shows the whole town. */
  focus?: PreviewCell | null;
  focusLabel?: string | null;
  /** Slugs of active locations. Null shows every landmark in the town. */
  activeSlugs?: ReadonlySet<string> | null;
};

/** The town drawn from the same grid, tiles and districts as the city map. */
export function EntryTownPreview({ focus = null, focusLabel = null, activeSlugs = null }: Props) {
  const landmarks = useMemo(() => previewLandmarks(activeSlugs), [activeSlugs]);
  const viewBox = previewViewBox(focus);
  const focusCentre = focus ? cellCentre(focus) : null;
  const caption =
    focus && focusLabel
      ? `Your last stop: ${focusLabel}.`
      : "A glimpse of the fictional town you can explore.";

  return (
    <figure className="entry-world" aria-labelledby="entry-world-caption">
      <svg
        viewBox={viewBox}
        role="img"
        aria-labelledby="entry-world-title"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="entry-world-title">
          {focus && focusLabel
            ? `Map of Osogbo around ${focusLabel}`
            : "Map of the playable Osun Life town"}
        </title>
        <rect x="-4000" y="-4000" width="9000" height="9000" fill="#d7e3d9" />
        {tiles.map((tile) => (
          <polygon
            key={tile.key}
            points={tile.points}
            fill={tile.fill}
            stroke="#688768"
            strokeOpacity={0.22}
            strokeWidth={1}
          />
        ))}
        {districts.map((district) => (
          <polygon
            key={district.id}
            points={district.corners.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="#ffffff"
            fillOpacity={0.08}
            stroke="#456b4e"
            strokeOpacity={0.65}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {!focus &&
          districts.map((district) => {
            const x = district.corners.reduce((sum, [px]) => sum + px, 0) / district.corners.length;
            const y =
              district.corners.reduce((sum, [, py]) => sum + py, 0) / district.corners.length;
            return (
              <text
                key={district.id}
                x={x}
                y={y}
                textAnchor="middle"
                className="entry-world-district"
              >
                {district.name}
              </text>
            );
          })}
        {landmarks.map((place) => {
          const centre = cellCentre(place.cell);
          const isLast = !!focus && place.cell.x === focus.x && place.cell.z === focus.z;
          return (
            <g key={place.id} transform={`translate(${centre.x} ${centre.y})`}>
              <circle
                r={isLast ? 11 : 7}
                fill={isLast ? "#014baa" : "#ffffff"}
                stroke="#14213d"
                strokeWidth={2}
              />
              <text y={-16} textAnchor="middle" className="entry-world-label">
                {place.label}
              </text>
            </g>
          );
        })}
        {focusCentre && (
          <g transform={`translate(${focusCentre.x} ${focusCentre.y})`} aria-hidden="true">
            <circle r={24} fill="none" stroke="#e7d9b4" strokeWidth={4} />
          </g>
        )}
      </svg>
      <figcaption id="entry-world-caption">{caption}</figcaption>
    </figure>
  );
}
