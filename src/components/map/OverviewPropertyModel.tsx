import { OverviewModelBatch } from "./OverviewModelBatch";
import { memo, type ReactNode } from "react";
import { OverviewBox } from "./OverviewModelResources";
import { OverviewLandmarkModel } from "./OverviewLandmarkModel";

type Vec = [number, number, number];
type Props = { profile: string; width: number; depth: number };
function Box({
  position,
  size,
  color,
  rotation,
}: {
  position: Vec;
  size: Vec;
  color: string;
  rotation?: Vec;
}) {
  return <OverviewBox position={position} size={size} color={color} rotation={rotation} />;
}
const wall = "#d6c2a0",
  roof = "#805849",
  glass = "#577983",
  concrete = "#aaa99c",
  grass = "#78925e";
function Dwelling({
  position,
  width,
  depth,
  floors = 1,
  modern = false,
}: {
  position: Vec;
  width: number;
  depth: number;
  floors?: number;
  modern?: boolean;
}) {
  const h = floors * 0.21;
  return (
    <group position={position}>
      <Box position={[0, h / 2, 0]} size={[width, h, depth]} color={modern ? "#e2ded3" : wall} />
      {modern ? (
        <Box
          position={[0, h + 0.025, 0]}
          size={[width * 1.08, 0.05, depth * 1.08]}
          color={concrete}
        />
      ) : (
        [-1, 1].map((side) => (
          <Box
            key={side}
            position={[(side * width) / 4, h + width * 0.11, 0]}
            size={[width * 0.56, 0.035, depth * 1.06]}
            rotation={[0, 0, -side * 0.38]}
            color={roof}
          />
        ))
      )}
      {Array.from({ length: floors }, (_, i) => (
        <group key={i}>
          {[-0.27, 0.27].map((x) => (
            <Box
              key={x}
              position={[x * width, 0.13 + i * 0.21, depth / 2 + 0.006]}
              size={[width * 0.19, 0.07, 0.012]}
              color={glass}
            />
          ))}
        </group>
      ))}
      <Box
        position={[0, 0.07, depth / 2 + 0.008]}
        size={[width * 0.18, 0.14, 0.016]}
        color={roof}
      />
      {floors > 1 && (
        <Box
          position={[0, 0.23, depth / 2 + 0.04]}
          size={[width * 0.8, 0.025, 0.09]}
          color={concrete}
        />
      )}
    </group>
  );
}
function Courtyard() {
  return (
    <>
      <Dwelling position={[0, 0.025, -0.27]} width={0.78} depth={0.29} />
      {[-0.3, 0.3].map((x) => (
        <Dwelling key={x} position={[x, 0.025, 0.1]} width={0.22} depth={0.42} />
      ))}
      <Box position={[0, 0.035, 0.09]} size={[0.3, 0.02, 0.4]} color="#c0a580" />
    </>
  );
}
function Workshop() {
  return (
    <>
      <Box position={[0, 0.11, -0.27]} size={[0.78, 0.18, 0.12]} color={wall} />
      {[-0.35, 0.35].map((x) => (
        <Box key={x} position={[x, 0.13, 0.03]} size={[0.06, 0.24, 0.48]} color={concrete} />
      ))}
      <Box position={[0, 0.27, 0]} size={[0.82, 0.05, 0.57]} color="#73796f" />
      <Box position={[0.24, 0.08, 0.14]} size={[0.16, 0.12, 0.2]} color={roof} />
    </>
  );
}
function Plaza() {
  return (
    <>
      <Box position={[0, 0.2, -0.1]} size={[0.82, 0.36, 0.55]} color="#e0dbce" />
      {[-0.26, 0, 0.26].map((x) => (
        <Box key={x} position={[x, 0.16, 0.182]} size={[0.21, 0.23, 0.02]} color={glass} />
      ))}
      <Box position={[0, 0.32, 0.24]} size={[0.88, 0.05, 0.21]} color={concrete} />
      <Box position={[0, 0.4, -0.1]} size={[0.86, 0.05, 0.59]} color={concrete} />
    </>
  );
}
/** Decorative, non-purchasable overview buildings, scaled to authored parcels. */
export const OverviewPropertyModel = memo(function OverviewPropertyModel({
  profile,
  width,
  depth,
}: Props) {
  if (
    profile === "filling-station" ||
    profile === "transit-pavilion" ||
    profile === "education-block"
  ) {
    return <OverviewLandmarkModel profile={profile} width={width} depth={depth} color={wall} />;
  }
  let model: ReactNode;
  switch (profile) {
    case "family-compound":
      model = <Courtyard />;
      break;
    case "duplex":
      model = <Dwelling position={[0, 0.025, 0]} width={0.68} depth={0.6} floors={2} modern />;
      break;
    case "apartment-block":
      model = <Dwelling position={[0, 0.025, 0]} width={0.78} depth={0.64} floors={3} modern />;
      break;
    case "residential-estate":
      model = (
        <>
          {[-0.23, 0.23].map((x) => (
            <Dwelling key={x} position={[x, 0.025, 0]} width={0.36} depth={0.58} modern />
          ))}
        </>
      );
      break;
    case "commercial-plaza":
      model = <Plaza />;
      break;
    case "mechanic-workshop":
      model = <Workshop />;
      break;
    case "industrial-shed":
      model = (
        <>
          <Box position={[0, 0.19, 0]} size={[0.84, 0.33, 0.72]} color="#aaa89c" />
          <Box position={[0, 0.37, 0]} size={[0.88, 0.06, 0.76]} color="#68736b" />
          <Box position={[0, 0.15, 0.37]} size={[0.4, 0.25, 0.02]} color="#535b56" />
        </>
      );
      break;
    default:
      model = <Dwelling position={[0, 0.025, 0]} width={0.7} depth={0.6} modern />;
  }
  return (
    <group scale={[width, Math.min(width, depth), depth]}>
      <OverviewModelBatch>
        <Box
          position={[0, 0.012, 0]}
          size={[0.94, 0.024, 0.94]}
          color={
            profile === "commercial-plaza" ||
            profile === "mechanic-workshop" ||
            profile === "industrial-shed"
              ? concrete
              : grass
          }
        />
        {model}
      </OverviewModelBatch>
    </group>
  );
});
