import React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Line-art landmark for a city, drawn on a 48×48 grid standing on a ground line at y=44.
// `fill` tints the buildings (e.g. the picked city) and `hole` paints arches and doors so they
// read as openings; both default to "none" for a plain outline.
export default function CityLandmark({ city, size = 52, stroke = "#5B5670", fill = "none", hole = "none", strokeWidth = 1.5 }) {
  const Draw = DRAWINGS[city] || skyline;
  const line = { stroke, strokeWidth, strokeLinejoin: "round", strokeLinecap: "round" };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {Draw({ line, body: { ...line, fill }, open: { ...line, fill: hole }, bare: { ...line, fill: "none" } })}
      <Path d="M2 44 H46" {...line} fill="none" />
    </Svg>
  );
}

// Each drawing gets three styles: `body` (filled shapes), `open` (arches/doors) and `bare` (lines).
const gatewayOfIndia = ({ body, open, bare }) => (
  <>
    <Rect x={8} y={20} width={32} height={24} {...body} />
    {[9, 17, 27, 35].map((x) => (
      <React.Fragment key={x}>
        <Rect x={x} y={14} width={4} height={6} {...body} />
        <Path d={`M${x} 14 a2 2 0 0 1 4 0`} {...body} />
      </React.Fragment>
    ))}
    <Path d="M8 24 H40" {...bare} />
    <Path d="M19 44 V31 a5 5 0 0 1 10 0 V44" {...open} />
    <Path d="M11 44 V36 a2.5 2.5 0 0 1 5 0 V44 M32 44 V36 a2.5 2.5 0 0 1 5 0 V44" {...open} />
  </>
);

const indiaGate = ({ body, open, bare }) => (
  <>
    <Rect x={14} y={14} width={20} height={30} {...body} />
    <Rect x={12} y={10} width={24} height={4} {...body} />
    <Rect x={18} y={6} width={12} height={4} {...body} />
    <Path d="M21 6 a3 2 0 0 1 6 0" {...body} />
    <Path d="M14 19 H34 M16 19 V44 M32 19 V44" {...bare} />
    <Path d="M19 44 V28 a5 5 0 0 1 10 0 V44" {...open} />
  </>
);

const shaniwarWada = ({ body, open, bare }) => (
  <>
    <Rect x={16} y={24} width={16} height={20} {...body} />
    <Path d="M6 44 V20 H8 V17 H10 V20 H12 V17 H14 V20 H16 V44 Z" {...body} />
    <Path d="M32 44 V20 H34 V17 H36 V20 H38 V17 H40 V20 H42 V44 Z" {...body} />
    <Rect x={19} y={17} width={10} height={7} {...body} />
    <Path d="M18 17 L24 12 L30 17" {...body} />
    <Path d="M6 28 H16 M32 28 H42" {...bare} />
    <Path d="M20 44 V34 a4 4 0 0 1 8 0 V44" {...open} />
    <Path d="M24 31 V44" {...bare} />
  </>
);

const vidhanaSoudha = ({ body, open, bare }) => (
  <>
    <Rect x={4} y={26} width={40} height={18} {...body} />
    <Rect x={6} y={22} width={6} height={4} {...body} />
    <Path d="M6 22 Q9 17 12 22" {...body} />
    <Rect x={36} y={22} width={6} height={4} {...body} />
    <Path d="M36 22 Q39 17 42 22" {...body} />
    <Rect x={15} y={22} width={18} height={4} {...body} />
    <Rect x={19} y={17} width={10} height={5} {...body} />
    <Path d="M18 17 Q24 5 30 17" {...body} />
    <Path d="M24 9 V5" {...bare} />
    <Path d="M18 28 V44 M22 28 V44 M26 28 V44 M30 28 V44 M4 32 H15 M33 32 H44" {...bare} />
    <Path d="M7 44 V38 h4 V44 M37 44 V38 h4 V44" {...open} />
  </>
);

const charminar = ({ body, open, bare }) => (
  <>
    <Rect x={12} y={20} width={24} height={24} {...body} />
    <Rect x={20} y={15} width={8} height={5} {...body} />
    <Path d="M20 15 Q24 10 28 15" {...body} />
    <Rect x={7} y={9} width={5} height={35} {...body} />
    <Path d="M7 9 Q9.5 3 12 9" {...body} />
    <Rect x={36} y={9} width={5} height={35} {...body} />
    <Path d="M36 9 Q38.5 3 41 9" {...body} />
    <Path d="M6 17 H13 M6 25 H13 M35 17 H42 M35 25 H42 M12 24 H36" {...bare} />
    <Path d="M17 44 V32 a7 7 0 0 1 14 0 V44" {...open} />
  </>
);

// Left edge of the gopuram runs from (13,34) up to (16,12); tiers cut across it.
const gx = (y) => 13 + ((34 - y) * 3) / 22;
const gopuram = ({ body, open, bare }) => (
  <>
    <Rect x={12} y={34} width={24} height={10} {...body} />
    <Path d="M13 34 L16 12 H32 L35 34 Z" {...body} />
    <Path d="M17 12 Q24 6 31 12" {...body} />
    <Path d={[29, 24, 19, 15].map((y) => `M${gx(y)} ${y} H${48 - gx(y)}`).join(" ")} {...bare} />
    <Path d="M20 8.6 V6 M24 7.5 V4 M28 8.6 V6" {...bare} />
    <Path d="M21 44 V38 a3 3 0 0 1 6 0 V44" {...open} />
  </>
);

const victoriaMemorial = ({ body, open, bare }) => (
  <>
    <Rect x={4} y={28} width={40} height={16} {...body} />
    <Rect x={6} y={23} width={5} height={5} {...body} />
    <Path d="M6 23 Q8.5 19 11 23" {...body} />
    <Rect x={37} y={23} width={5} height={5} {...body} />
    <Path d="M37 23 Q39.5 19 42 23" {...body} />
    <Rect x={16} y={23} width={16} height={5} {...body} />
    <Rect x={19} y={18} width={10} height={5} {...body} />
    <Path d="M18 18 Q24 6 30 18" {...body} />
    <Path d="M24 10 V5" {...bare} />
    <Circle cx={24} cy={4} r={1} {...body} />
    <Path d="M4 32 H44" {...bare} />
    <Path d="M9 44 V38 a2 2 0 0 1 4 0 V44 M35 44 V38 a2 2 0 0 1 4 0 V44" {...open} />
    <Path d="M21 44 V37 a3 3 0 0 1 6 0 V44" {...open} />
  </>
);

const mosque = ({ body, open, bare }) => (
  <>
    <Rect x={10} y={26} width={28} height={18} {...body} />
    <Path d="M11.5 26 Q14.5 21 17.5 26 M30.5 26 Q33.5 21 36.5 26" {...body} />
    <Path d="M19 26 Q24 15 29 26" {...body} />
    <Path d="M5 44 V12 L7 7 L9 12 V44 Z M39 44 V12 L41 7 L43 12 V44 Z" {...body} />
    <Path d="M4 20 H10 M4 28 H10 M38 20 H44 M38 28 H44" {...bare} />
    <Path d="M13 44 V37 a2.5 2.5 0 0 1 5 0 V44 M30 44 V37 a2.5 2.5 0 0 1 5 0 V44" {...open} />
    <Path d="M21 44 V35 a3 3 0 0 1 6 0 V44" {...open} />
  </>
);

const lakeTemple = ({ body, open, bare }) => (
  <>
    <Rect x={17} y={26} width={14} height={10} {...body} />
    <Path d="M18 26 Q19 15 24 10 Q29 15 30 26 Z" {...body} />
    <Path d="M24 10 V5 L28 6.5 L24 8" {...bare} />
    <Path d="M12 36 H36 M20 21 H28 M19 16 H29" {...bare} />
    <Path d="M22 36 V31 a2 2 0 0 1 4 0 V36" {...open} />
    <Path d="M4 40 q3 -2.5 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" {...bare} />
  </>
);

const bridgeSkyline = ({ body, bare }) => (
  <>
    <Rect x={8} y={16} width={8} height={22} {...body} />
    <Rect x={18} y={8} width={9} height={30} {...body} />
    <Rect x={29} y={19} width={9} height={19} {...body} />
    <Path d="M10 21 H14 M10 26 H14 M10 31 H14 M21 13 H24 M21 18 H24 M21 23 H24 M21 28 H24 M31 24 H36 M31 29 H36" {...bare} />
    <Path d="M2 38 H46 M8 38 V44 M24 38 V44 M40 38 V44 M2 41 Q5 38.5 8 41 M8 41 Q16 36 24 41 M24 41 Q32 36 40 41 M40 41 Q43 38.5 46 41" {...bare} />
  </>
);

const towers = ({ body, bare }) => (
  <>
    <Rect x={7} y={20} width={10} height={24} {...body} />
    <Path d="M20 44 V11 L26 5 L32 11 V44 Z" {...body} />
    <Rect x={35} y={24} width={7} height={20} {...body} />
    <Path d="M9 25 H15 M9 30 H15 M9 35 H15 M9 40 H15 M26 8 V44 M20 17 H32 M20 23 H32 M20 29 H32 M20 35 H32 M37 29 H40 M37 34 H40 M37 39 H40" {...bare} />
  </>
);

const glassTowers = ({ body, bare }) => (
  <>
    <Path d="M7 44 V17 Q13 10 20 12 V44 Z" {...body} />
    <Path d="M23 44 V6 L34 12 V44 Z" {...body} />
    <Rect x={36} y={26} width={7} height={18} {...body} />
    <Path d="M7 23 L20 19 M7 29 L20 25 M7 35 L20 31 M7 41 L20 37 M23 15 L34 19 M23 22 L34 26 M23 29 L34 33 M23 36 L34 40 M28.5 9 V44" {...bare} />
  </>
);

function skyline({ body, bare }) {
  return (
    <>
      <Rect x={8} y={22} width={9} height={22} {...body} />
      <Rect x={19} y={12} width={10} height={32} {...body} />
      <Rect x={31} y={18} width={9} height={26} {...body} />
      <Path d="M22 17 H26 M22 23 H26 M22 29 H26 M22 35 H26" {...bare} />
    </>
  );
}

const DRAWINGS = {
  Mumbai: gatewayOfIndia,
  "Delhi NCR": indiaGate,
  Delhi: indiaGate,
  Pune: shaniwarWada,
  Bengaluru: vidhanaSoudha,
  Hyderabad: charminar,
  Chennai: gopuram,
  Kolkata: victoriaMemorial,
  Ahmedabad: mosque,
  Thane: lakeTemple,
  "Navi Mumbai": bridgeSkyline,
  Noida: towers,
  Gurugram: glassTowers,
};
