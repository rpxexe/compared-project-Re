import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { LogoMark } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import exitAuthFlow from "../navigation/exitAuthFlow";
import { colors, fonts } from "../theme";
import Text, { AnimatedText } from "../components/AppText";

const { width: W } = Dimensions.get("window");
const TOWERS = [0.12, 0.3, 0.48, 0.66, 0.84];

// Short (≈2s) celebratory transition. When it ends the app switches to the signed-in stack.
export default function AuthWelcomeScreen({ navigation, route }) {
  const { token, user } = route.params;
  const { signIn } = useAuth();
  const rise = useRef(TOWERS.map(() => new Animated.Value(0))).current;
  const t1 = useRef(new Animated.Value(0)).current;
  const t2 = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      ...rise.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          delay: i * 90,
          easing: ease,
          useNativeDriver: true,
        }),
      ),
      Animated.spring(mark, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(t1, {
          toValue: 1,
          duration: 450,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(t2, {
          toValue: 1,
          duration: 450,
          easing: ease,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    // The stack's initial route is fixed at mount, so after signing in we must leave the
    // auth screens explicitly (back to where sign-in started, or to the tabs).
    const id = setTimeout(async () => {
      await signIn(token, user);
      exitAuthFlow(navigation);
    }, 2100);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.ink, colors.plum]}
        style={StyleSheet.absoluteFill}
      />
      {TOWERS.map((x, i) => (
        <Animated.View
          key={i}
          style={[
            styles.tower,
            {
              left: W * x - 14,
              height: 120 + (i % 3) * 50,
              backgroundColor:
                i % 2 ? "rgba(199,125,255,0.4)" : "rgba(166,107,255,0.45)",
              transform: [
                {
                  translateY: rise[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [200, 0],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <View style={styles.center}>
        <Animated.View style={{ opacity: mark, transform: [{ scale: mark }] }}>
          <LogoMark size={76} />
        </Animated.View>
        <AnimatedText
          style={[
            styles.welcome,
            {
              opacity: t1,
              transform: [
                {
                  translateY: t1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Welcome to
        </AnimatedText>
        <AnimatedText
          style={[
            styles.brand,
            {
              opacity: t2,
              transform: [
                {
                  translateY: t2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Compare Projects
        </AnimatedText>
        {user?.name ? (
          <AnimatedText style={[styles.name, { opacity: t2 }]}>
            {user.name.split(" ")[0]}
          </AnimatedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  tower: {
    position: "absolute",
    bottom: 0,
    width: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  welcome: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    letterSpacing: 4,
    marginTop: 28,
    textTransform: "uppercase",
  },
  brand: {
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 38,
    marginTop: 6,
  },
  name: { color: colors.gold, fontSize: 16, fontWeight: "700", marginTop: 12 },
});
