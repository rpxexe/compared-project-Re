import React from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { gradients } from "../theme";

const RESIDENCE = require("../../assets/onboarding_residence.jpg");

// Lavender canvas with residential architecture bleeding in from the top-right, as in the
// onboarding reference. The photo is faded into the canvas on its left and bottom edges so
// headlines placed over the left side always sit on a calm, near-solid background.
export default function OnboardingBackdrop({ imageHeight = 340, imageWidth = 0.66 }) {
  const { width: W } = useWindowDimensions();
  const imgW = Math.round(W * imageWidth);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={gradients.canvas}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.photoWrap, { width: imgW, height: imageHeight }]}>
        <Image
          source={RESIDENCE}
          style={styles.photo}
          resizeMode="cover"
          fadeDuration={0}
          accessibilityIgnoresInvertColors
        />
        {/* Lavender wash pulls the warm photo into the brand palette. */}
        <View style={[StyleSheet.absoluteFill, styles.wash]} />
        <LinearGradient
          colors={["#FBF9FF", "rgba(251,249,255,0.55)", "rgba(251,249,255,0)"]}
          locations={[0, 0.4, 0.8]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(247,242,255,0)", "rgba(247,242,255,0.85)", "#F7F2FF"]}
          locations={[0.45, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Svg
        width={W}
        height={imageHeight * 0.6}
        style={{ position: "absolute", top: imageHeight * 0.55, left: 0 }}
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
      >
        <Defs>
          <SvgGradient id="obSwoosh" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#E9DDFF" stopOpacity="0" />
            <Stop offset="0.6" stopColor="#E3D3FF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.7" />
          </SvgGradient>
        </Defs>
        <Path d="M0 170 C 140 150, 260 110, 400 20 L 400 60 C 270 140, 150 175, 0 190 Z" fill="url(#obSwoosh)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  photoWrap: { position: "absolute", top: 0, right: 0, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  wash: { backgroundColor: "rgba(190,160,255,0.26)" },
});
