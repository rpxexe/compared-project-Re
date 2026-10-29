import React from "react";
import Svg, { Circle, Rect } from "react-native-svg";

// Tiny vector flag so the country selector needs no bitmap asset.
export default function IndiaFlag({ width = 24 }) {
  const h = (width * 2) / 3;
  return (
    <Svg width={width} height={h} viewBox="0 0 30 20" accessibilityElementsHidden importantForAccessibility="no">
      <Rect x="0" y="0" width="30" height="20" rx="2.5" fill="#FFFFFF" />
      <Rect x="0" y="0" width="30" height="6.67" rx="2.5" fill="#FF9933" />
      <Rect x="0" y="4" width="30" height="2.67" fill="#FF9933" />
      <Rect x="0" y="13.33" width="30" height="2.67" fill="#138808" />
      <Rect x="0" y="13.33" width="30" height="6.67" rx="2.5" fill="#138808" />
      <Circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.9" />
      <Circle cx="15" cy="10" r="0.7" fill="#000080" />
    </Svg>
  );
}
