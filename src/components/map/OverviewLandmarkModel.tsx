import type { ReactNode } from "react";

type ModelProps = { profile: string; width: number; depth: number; color: string };
type Vec = [number, number, number];

function Box({ p, s, color }: { p: Vec; s: Vec; color: string }) {
  return <mesh position={p}><boxGeometry args={s}/><meshStandardMaterial color={color}/></mesh>;
}
function Cylinder({ p, radius, height, color, sides = 16 }: { p: Vec; radius: number; height: number; color: string; sides?: number }) {
  return <mesh position={p}><cylinderGeometry args={[radius, radius, height, sides]}/><meshStandardMaterial color={color}/></mesh>;
}
function Roof({ p, color }: { p: Vec; color: string }) {
  return <mesh position={p} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.44, 0.24, 4]}/><meshStandardMaterial color={color}/></mesh>;
}
const roof = "#765345", glass = "#577a83", cream = "#e5d5b8", stone = "#b7b3a5", green = "#567b46";
function Trees() {
  return <>{[-0.29, 0, 0.29].flatMap(x => [-0.28, 0.28].map(z => <group key={`${x}:${z}`} position={[x,0,z]}>
    <Cylinder p={[0,0.10,0]} radius={0.025} height={0.20} color={roof} sides={6}/>
    <mesh position={[0,0.26,0]}><icosahedronGeometry args={[0.12,0]}/><meshStandardMaterial color={green}/></mesh>
  </group>))}</>;
}
function Facade({ color, height = 0.32 }: { color: string; height?: number }) {
  return <><Box p={[0,height/2,0]} s={[0.83,height,0.68]} color={color}/>
    <Box p={[0,height+0.025,0]} s={[0.89,0.05,0.74]} color={stone}/>
    {[-0.27,0,0.27].map(x => <Box key={x} p={[x,height*0.57,0.346]} s={[0.13,height*0.32,0.018]} color={glass}/>)}
    <Box p={[0,height*0.20,0.35]} s={[0.13,height*0.40,0.022]} color={roof}/></>;
}

/** Models use normalized local coordinates; the enclosing footprint controls their scale. */
export function OverviewLandmarkModel({ profile, width, depth, color }: ModelProps) {
  let model: ReactNode;
  switch (profile) {
    case "flyover":
      model = <><Box p={[0,0.33,0]} s={[0.94,0.09,0.30]} color={stone}/>
        {[-0.32,0,0.32].map(x => <Box key={x} p={[x,0.15,0]} s={[0.09,0.30,0.18]} color={cream}/>)}
        {[-0.14,0.14].map(z => <Box key={z} p={[0,0.40,z]} s={[0.94,0.05,0.025]} color={stone}/>)}</>; break;
    case "roundabout":
      model = <><Cylinder p={[0,0.035,0]} radius={0.40} height={0.07} color={stone}/>
        <Cylinder p={[0,0.075,0]} radius={0.30} height={0.04} color={green}/>
        <Cylinder p={[0,0.22,0]} radius={0.07} height={0.27} color={cream}/>
        <mesh position={[0,0.39,0]}><icosahedronGeometry args={[0.10,0]}/><meshStandardMaterial color={roof}/></mesh></>; break;
    case "yoruba-palace":
      model = <><Box p={[0,0.025,0]} s={[0.92,0.05,0.92]} color={cream}/>
        <Box p={[0,0.16,-0.27]} s={[0.82,0.27,0.34]} color={color}/>
        <Roof p={[0,0.39,-0.27]} color={roof}/>
        {[-0.36,0.36].map(x => <Box key={x} p={[x,0.13,0.10]} s={[0.17,0.23,0.52]} color={color}/>)}
        {[-0.22,0.22].map(x => <Box key={x} p={[x,0.18,0.39]} s={[0.14,0.31,0.10]} color={cream}/>)}
        <Box p={[0,0.34,0.39]} s={[0.58,0.08,0.14]} color={roof}/></>; break;
    case "mosque": case "worship-building":
      model = <><Box p={[0,0.15,0]} s={[0.62,0.30,0.65]} color={cream}/>
        <mesh position={[0,0.30,0]}><sphereGeometry args={[0.25,16,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={green}/></mesh>
        {[-0.37,0.37].map(x => <Cylinder key={x} p={[x,0.28,0.26]} radius={0.055} height={0.56} color={cream}/>)}</>; 
      if(profile === "worship-building") model = <Facade color={cream} height={0.42}/>;
      break;
    case "traditional-market": case "market-hall":
      model = <>{[-0.27,0,0.27].flatMap(x => [-0.23,0.23].map((z,i) => <group key={`${x}:${z}`}>
        <Box p={[x,0.09,z]} s={[0.23,0.18,0.36]} color={cream}/>
        <Box p={[x,0.22,z]} s={[0.25,0.06,0.40]} color={i ? roof : "#a68b4e"}/>
      </group>))}</>; break;
    case "modern-mall":
      model = <><Facade color={cream} height={0.38}/><Box p={[0,0.20,0.355]} s={[0.69,0.22,0.025]} color={glass}/>
        <Box p={[0,0.16,0.42]} s={[0.36,0.045,0.13]} color={stone}/><Box p={[0,0.45,0]} s={[0.50,0.09,0.36]} color={color}/></>; break;
    case "stadium":
      model = <><Box p={[0,0.025,0]} s={[0.92,0.05,0.92]} color={stone}/>
        <Box p={[0,0.055,0]} s={[0.56,0.025,0.68]} color={green}/>
        {[-0.37,0.37].map(x => <group key={x}><Box p={[x,0.10,0]} s={[0.16,0.20,0.82]} color={cream}/><Box p={[x,0.23,0]} s={[0.10,0.06,0.84]} color={roof}/></group>)}
        {[-0.39,0.39].map(z => <Box key={z} p={[0,0.09,z]} s={[0.58,0.17,0.10]} color={cream}/>)}</>; break;
    case "government-complex": case "courthouse": case "assembly-hall":
      model = <><Facade color={cream} height={profile === "government-complex" ? 0.48 : 0.35}/>
        <Box p={[0,0.035,0.40]} s={[0.55,0.07,0.16]} color={stone}/>
        {[-0.21,-0.07,0.07,0.21].map(x => <Cylinder key={x} p={[x,0.20,0.39]} radius={0.025} height={0.33} color={cream}/>)}
        <Box p={[0,0.39,0.39]} s={[0.54,0.075,0.13]} color={stone}/>
        {profile === "assembly-hall" && <Cylinder p={[0,0.46,0]} radius={0.22} height={0.12} color={roof}/>}</>; break;
    case "forest-heritage": case "public-park":
      model = <><Box p={[0,0.02,0]} s={[0.94,0.04,0.94]} color={green}/><Trees/>
        {profile === "forest-heritage" ? <Cylinder p={[0,0.15,0]} radius={0.075} height={0.27} color={stone} sides={6}/> : <Box p={[0,0.08,0]} s={[0.38,0.10,0.14]} color={cream}/>}</>; break;
    case "art-gallery":
      model = <><Facade color={color} height={0.30}/><Roof p={[0,0.42,0]} color={roof}/>
        <Cylinder p={[0,0.09,0.41]} radius={0.07} height={0.16} color={stone}/></>; break;
    case "recreation-ground":
      model = <><Box p={[0,0.025,0]} s={[0.90,0.05,0.90]} color={green}/><Box p={[0,0.055,0]} s={[0.60,0.02,0.60]} color="#879c65"/></>; break;
    case "transit-pavilion":
      model = <><Box p={[0,0.025,0]} s={[0.90,0.05,0.80]} color={stone}/>
        {[-0.35,0.35].map(x => <Box key={x} p={[x,0.16,-0.15]} s={[0.05,0.32,0.05]} color={roof}/>)}
        <Box p={[0,0.34,-0.15]} s={[0.85,0.06,0.45]} color={cream}/></>; break;
    case "junction-sculpture":
      model = <><Cylinder p={[0,0.04,0]} radius={0.28} height={0.08} color={stone}/><Cylinder p={[0,0.19,0]} radius={0.08} height={0.25} color={color}/></>; break;
    case "education-block":
      model = <><Facade color={cream} height={0.42}/>
        <Box p={[0,0.22,-0.36]} s={[0.72,0.40,0.12]} color={color}/>
        {[-0.28,0,0.28].map(x => <Box key={x} p={[x,0.34,0.35]} s={[0.12,0.075,0.022]} color={glass}/>)}
        <Box p={[0,0.035,0.41]} s={[0.55,0.07,0.14]} color={stone}/></>; break;
    case "clinic":
      model = <><Facade color={cream} height={0.30}/>
        <Box p={[0,0.26,0.366]} s={[0.20,0.055,0.022]} color="#a74f48"/>
        <Box p={[0,0.26,0.368]} s={[0.055,0.18,0.024]} color="#a74f48"/>
        <Box p={[0,0.17,0.41]} s={[0.35,0.035,0.15]} color={stone}/></>; break;
    case "eatery":
      model = <><Facade color={color} height={0.24}/>
        <Box p={[0,0.24,0.40]} s={[0.86,0.045,0.19]} color={roof}/>
        {[-0.35,0.35].map(x => <Box key={x} p={[x,0.11,0.45]} s={[0.035,0.22,0.035]} color={stone}/>)}
        <Box p={[0,0.06,0.43]} s={[0.28,0.05,0.10]} color={cream}/></>; break;
    case "service-building":
      model = <><Facade color={color} height={0.35}/>
        <Box p={[0,0.36,0.37]} s={[0.70,0.065,0.025]} color={cream}/>
        <Box p={[0,0.19,0.37]} s={[0.20,0.22,0.025]} color={glass}/></>; break;
    default:
      model = <Facade color={color}/>;
  }
  return <group scale={[width, Math.min(width,depth), depth]}>{model}</group>;
}
