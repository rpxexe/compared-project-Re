import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Button from "../components/Button";
import { api, session } from "../services/api";
import * as firebasePhone from "../services/firebasePhone";
import { useAuth } from "../context/AuthContext";
import exitAuthFlow from "../navigation/exitAuthFlow";
import { otpDigits } from "../utils/validators";
import { formatPhone } from "../utils/format";
import { brand, colors, fonts } from "../theme";
import { isReducedMotion } from "../hooks/useReducedMotion";
import Text, { AppTextInput as TextInput } from "../components/AppText";

const LEN = 6;
// Soft lavender-grey tile: the theme's take on the light grey boxes.
const BOX_BG = "#F3EFFA";

// One code box. It rises in on mount (staggered left to right), lifts with a pulsing ring while
// it's the box being typed into, drops each digit in, jitters in a wave on a wrong code and hops
// in a wave on success. Reduced motion keeps only the colour changes.
function Box({ char, active, state, index }) {
  const reduced = isReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(1)).current;
  const jitter = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const prev = useRef("");

  useEffect(() => {
    if (reduced) return;
    Animated.spring(enter, { toValue: 1, delay: 80 + index * 55, speed: 10, bounciness: 10, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduced) return;
    Animated.spring(lift, { toValue: active ? 1 : 0, speed: 16, bounciness: 8, useNativeDriver: true }).start();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (char && char !== prev.current && !reduced) {
      drop.setValue(0);
      Animated.spring(drop, { toValue: 1, speed: 18, bounciness: 12, useNativeDriver: true }).start();
    }
    prev.current = char;
  }, [char]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduced) return;
    if (state === "error") {
      jitter.setValue(0);
      Animated.sequence([
        Animated.delay(index * 40),
        ...[-7, 7, -5, 5, -2, 0].map((v) => Animated.timing(jitter, { toValue: v, duration: 50, useNativeDriver: true })),
      ]).start();
    } else if (state === "success") {
      hop.setValue(0);
      Animated.sequence([
        Animated.delay(index * 70),
        Animated.timing(hop, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(hop, { toValue: 0, speed: 12, bounciness: 14, useNativeDriver: true }),
      ]).start();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const borderColor =
    state === "error"
      ? colors.error
      : state === "success"
        ? colors.success
        : active
          ? brand.violet
          : "transparent";
  const slot = {
    opacity: enter,
    transform: [
      {
        translateY: Animated.add(
          Animated.add(
            enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
            lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
          ),
          hop.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
        ),
      },
      { translateX: jitter },
      { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  };
  return (
    // Six boxes share the row (up to 52px each) so they fit narrow phones too.
    <Animated.View style={[styles.boxSlot, slot]}>
      {active && !reduced ? <PulseRing /> : null}
      <View
        style={[
          styles.box,
          {
            borderColor,
            backgroundColor: state === "success" ? "#E8F3EC" : state === "error" ? brand.errorSoft : active ? colors.white : BOX_BG,
          },
          active && styles.boxGlow,
        ]}
      >
        <Animated.View
          style={char ? {
            opacity: drop,
            transform: [
              { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
              { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            ],
          } : null}
        >
          <Text
            style={[
              styles.digit,
              !char && styles.dash,
              state === "success" && { color: colors.success },
              state === "error" && { color: colors.error },
            ]}
          >
            {char || (active ? "" : "-")}
          </Text>
        </Animated.View>
        {active && !char ? <Caret /> : null}
      </View>
    </Animated.View>
  );
}

// Soft violet ring that keeps pulsing out of the active box.
function PulseRing() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulse, {
        opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] }),
        transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }, { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
      }]}
    />
  );
}

// Caret that breathes (eased fade) instead of hard blinking.
function Caret() {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.15, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [o]);
  return <Animated.View style={[styles.caret, { opacity: o }]} />;
}

export default function OtpScreen({ navigation, route }) {
  const { phone, role, name, resendIn = 30 } = route.params;
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | error | success
  const [error, setError] = useState("");
  const [secs, setSecs] = useState(resendIn);
  const [resending, setResending] = useState(false);
  const [focused, setFocused] = useState(true);
  const input = useRef(null);
  const check = useRef(new Animated.Value(0)).current;
  const verifying = useRef(false);

  useEffect(() => {
    if (secs <= 0) return undefined;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const done = useRef(false);

  // Firebase checks the code; the signed-in Firebase user is then exchanged for the app's customer
  // account + session. Skips the code check when Firebase already signed this number in (Android
  // auto-verification or a retry).
  const firebaseSession = useCallback(async (value) => {
    if (firebasePhone.currentPhone() !== `+91${phone}`) await firebasePhone.confirmCode(value);
    return api.v2.register(await firebasePhone.idToken(), name);
  }, [phone, name]);

  const verify = useCallback(
    async (value) => {
      if (verifying.current || done.current) return;
      verifying.current = true;
      setState("loading");
      setError("");
      try {
        const r = await firebaseSession(value);
        done.current = true;
        await session.save(r.token, r.user); // makes the token available to the profile update below
        let user = r.user;
        // Apply what the login screen collected: the name (if typed) and, for new accounts, the
        // purpose from the chosen account type (the backend grants the broker role from
        // purpose = "broker"). Best effort: a failure here must not block sign-in; both can
        // still be changed later in Profile / Settings.
        const patch = {};
        if (name && name !== user.name) patch.name = name;
        if (!user.purpose && (role === "owner" || role === "broker")) patch.purpose = role;
        if (Object.keys(patch).length) {
          try {
            user = (await api.updateMe(patch)).user || user;
          } catch {
            /* keep the unmodified user */
          }
        }
        setState("success");
        Animated.spring(check, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }).start();
        // Brief pause so the "Verified" tick registers, then straight into the app.
        setTimeout(async () => {
          await signIn(r.token, user);
          exitAuthFlow(navigation);
        }, 700);
      } catch (e) {
        setState("error");
        setError(String(e.code || "").startsWith("auth/") ? firebasePhone.friendlyError(e) : e.message);
        if (firebasePhone.needsNewCode(e)) setSecs(0);
        setTimeout(() => {
          setCode("");
          setState("idle");
          input.current?.focus();
        }, 650);
      } finally {
        verifying.current = false;
      }
    },
    [phone, role, name, firebaseSession, navigation, check, signIn],
  );

  // Android may read the SMS and sign in by itself; finish as if the code had been typed.
  useEffect(() => firebasePhone.onSignedIn((user) => {
    if (user.phoneNumber === `+91${phone}`) verify("");
  }), [phone, verify]);

  const onChange = (text) => {
    if (state === "loading" || state === "success") return;
    const digits = otpDigits(text, LEN).join("");
    setCode(digits);
    setError("");
    if (digits.length === LEN) verify(digits);
  };

  const resend = async () => {
    setResending(true);
    setError("");
    try {
      await firebasePhone.sendCode(phone);
      setSecs(30);
      setCode("");
      input.current?.focus();
    } catch (e) {
      setError(String(e.code || "").startsWith("auth/") ? firebasePhone.friendlyError(e) : e.message);
    } finally {
      setResending(false);
    }
  };

  const chars = code.split("");
  const complete = code.length === LEN;
  return (
    <Screen keyboard>
      <ScreenHeader title=" " back style={{ marginBottom: 8 }} />
      <View style={styles.body}>
        <Text style={styles.h1} accessibilityRole="header">Verify Code</Text>
        <Text style={styles.sub}>Please enter the 6-digit code we just sent to</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.phone}>{formatPhone(phone)}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change number">
            <Ionicons name="create-outline" size={16} color={brand.violet} />
          </Pressable>
        </View>

        <View style={styles.boxesWrap}>
          <Animated.View
            pointerEvents="none"
            style={styles.boxes}
          >
            {Array.from({ length: LEN }).map((_, i) => (
              <Box
                key={i}
                index={i}
                char={chars[i] || ""}
                active={
                  focused &&
                  state === "idle" &&
                  i === Math.min(chars.length, LEN - 1)
                }
                state={state === "loading" ? "idle" : state}
              />
            ))}
          </Animated.View>
          {/* The real input is stretched over the boxes, so tapping a box opens the number keyboard.
              It also handles typing, backspace and pasting the whole code. */}
          <TextInput
            ref={input}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            maxLength={LEN + 6}
            autoFocus
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            caretHidden
            selectionColor="transparent"
            style={styles.overlay}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={state !== "loading" && state !== "success"}
            accessibilityLabel="OTP input"
          />
        </View>

        <View style={styles.status}>
          {state === "success" ? (
            <Animated.View
              style={[
                styles.okRow,
                { opacity: check, transform: [{ scale: check }] },
              ]}
            >
              <View>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.okBurst, {
                    opacity: check.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0], extrapolate: "clamp" }),
                    transform: [{ scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }) }],
                  }]}
                />
                <View style={styles.okCircle}>
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                </View>
              </View>
              <Text style={styles.okText}>Verified</Text>
            </Animated.View>
          ) : error ? (
            <Text style={styles.err}>{error}</Text>
          ) : null}
        </View>

        <View style={styles.resendWrap}>
          <Text style={styles.resendQ}>Didn't receive OTP?</Text>
          {secs > 0 ? (
            <Text style={styles.timer}>
              Resend code in{" "}
              <Text style={{ fontWeight: "800", color: colors.ink }}>
                0:{String(secs).padStart(2, "0")}
              </Text>
            </Text>
          ) : (
            <Pressable onPress={resend} disabled={resending} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.resend, resending && { opacity: 0.5 }]}>
                {resending ? "Sending…" : "Resend code"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* The code verifies itself once all 6 digits are in; the button lets you tap it manually. */}
        <Button
          title={state === "success" ? "Verified" : "Verify"}
          onPress={() => verify(code)}
          loading={state === "loading"}
          disabled={!complete || state === "success"}
          style={styles.verifyBtn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, alignItems: "center" },
  h1: {
    fontFamily: fonts.serif,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontSize: 30,
    color: brand.ink,
    marginTop: 12,
    textAlign: "center",
  },
  sub: { color: colors.muted, fontSize: 14, marginTop: 10, textAlign: "center" },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  phone: { fontSize: 15, fontWeight: "700", color: brand.violet },
  boxesWrap: { marginTop: 32, height: 58, alignSelf: "stretch" },
  boxes: { flexDirection: "row", justifyContent: "center", gap: 8 },
  boxSlot: { flex: 1, maxWidth: 52 },
  pulse: { ...StyleSheet.absoluteFillObject, borderRadius: 14, borderWidth: 2, borderColor: brand.violet },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    opacity: 0.02,
  },
  box: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  boxGlow: {
    shadowColor: brand.violet,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  digit: { fontSize: 22, fontWeight: "800", color: colors.ink },
  dash: { color: brand.placeholder, fontWeight: "600" },
  caret: {
    position: "absolute",
    width: 2,
    height: 24,
    backgroundColor: brand.violet,
    borderRadius: 1,
  },
  status: { minHeight: 36, justifyContent: "center", alignItems: "center", marginTop: 12 },
  err: {
    color: colors.error,
    fontWeight: "700",
    fontSize: 13.5,
    textAlign: "center",
  },
  okRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  okCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  okBurst: { position: "absolute", width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.success },
  okText: { color: colors.success, fontWeight: "800", fontSize: 15 },
  resendWrap: { alignItems: "center", gap: 6, marginTop: 14 },
  resendQ: { color: colors.muted, fontSize: 13.5 },
  resend: { color: brand.ink, fontSize: 14, fontWeight: "800", textDecorationLine: "underline" },
  timer: { color: colors.muted, fontSize: 13.5 },
  verifyBtn: { alignSelf: "stretch", marginTop: 32 },
});
