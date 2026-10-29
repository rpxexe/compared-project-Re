import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Button from "../components/Button";
import { api, session } from "../services/api";
import { useAuth } from "../context/AuthContext";
import exitAuthFlow from "../navigation/exitAuthFlow";
import { otpDigits } from "../utils/validators";
import { formatPhone } from "../utils/format";
import PressableScale from "../components/PressableScale";
import { brand, colors, fonts, radius, shadow } from "../theme";

const LEN = 6;

function Box({ char, active, state, index }) {
  const pop = useRef(new Animated.Value(1)).current;
  const prev = useRef("");
  useEffect(() => {
    if (char && char !== prev.current) {
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 1.14,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(pop, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 12,
        }),
      ]).start();
    }
    prev.current = char;
  }, [char, pop]);
  useEffect(() => {
    if (state === "success")
      Animated.sequence([
        Animated.delay(index * 60),
        Animated.timing(pop, {
          toValue: 0.85,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(pop, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 14,
        }),
      ]).start();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const borderColor =
    state === "error"
      ? colors.error
      : state === "success"
        ? colors.success
        : active || char
          ? brand.violet
          : "#E3D9F7";
  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <View
        style={[
          styles.box,
          {
            borderColor,
            backgroundColor: state === "success" ? "#E8F3EC" : colors.white,
          },
          active && styles.boxGlow,
        ]}
      >
        <Text
          style={[
            styles.digit,
            state === "success" && { color: colors.success },
            state === "error" && { color: colors.error },
          ]}
        >
          {char}
        </Text>
        {active && !char ? <Caret /> : null}
      </View>
    </Animated.View>
  );
}

function Caret() {
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(o, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(o, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [o]);
  return <Animated.View style={[styles.caret, { opacity: o }]} />;
}

export default function OtpScreen({ navigation, route }) {
  const { phone, role, devOtp: initialDev, resendIn = 30 } = route.params;
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | error | success
  const [error, setError] = useState("");
  const [secs, setSecs] = useState(resendIn);
  const [devOtp, setDevOtp] = useState(initialDev);
  const [resending, setResending] = useState(false);
  const [focused, setFocused] = useState(true);
  const input = useRef(null);
  const shake = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const verifying = useRef(false);

  useEffect(() => {
    if (secs <= 0) return undefined;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const doShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) =>
        Animated.timing(shake, {
          toValue: v,
          duration: 55,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [shake]);

  const verify = useCallback(
    async (value) => {
      if (verifying.current) return;
      verifying.current = true;
      setState("loading");
      setError("");
      try {
        const r = await api.verifyOtp(phone, value);
        await session.save(r.token, r.user); // makes the token available to the profile update below
        let user = r.user;
        // New accounts take their purpose from the account type chosen on the login screen
        // (the backend grants the broker role from purpose = "broker"). Best effort: a failure
        // here must not block sign-in; it can still be changed later in Settings.
        if (!user.purpose && (role === "owner" || role === "broker")) {
          try {
            user = (await api.updateMe({ purpose: role })).user || user;
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
        setError(e.message);
        doShake();
        if (e.code === "OTP_EXPIRED" || e.code === "OTP_LOCKED") setSecs(0);
        setTimeout(() => {
          setCode("");
          setState("idle");
          input.current?.focus();
        }, 650);
      } finally {
        verifying.current = false;
      }
    },
    [phone, role, navigation, check, doShake, signIn],
  );

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
      const r = await api.sendOtp(phone);
      setSecs(r.resendInSeconds ?? 30);
      setDevOtp(r.devOtp || null);
      setCode("");
      input.current?.focus();
    } catch (e) {
      if (e.status === 429 && e.retryAfterSeconds) setSecs(e.retryAfterSeconds);
      setError(e.message);
    } finally {
      setResending(false);
    }
  };

  const chars = code.split("");
  return (
    <Screen keyboard>
      <ScreenHeader title=" " back style={{ marginBottom: 8 }} />
      <View style={{ paddingHorizontal: 24 }}>
        <Text style={styles.h1}>Verify your number</Text>
        <Text style={styles.sub}>Enter the 6-digit code sent to</Text>
        <View style={styles.phoneRow}>
          <Text style={styles.phone}>{formatPhone(phone)}</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.edit}>Change</Text>
          </Pressable>
        </View>

        <View style={styles.boxesWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.boxes, { transform: [{ translateX: shake }] }]}
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
              <View style={styles.okCircle}>
                <Ionicons name="checkmark" size={22} color={colors.white} />
              </View>
              <Text style={styles.okText}>Verified</Text>
            </Animated.View>
          ) : state === "loading" ? (
            <Text style={styles.verifying}>Verifying…</Text>
          ) : error ? (
            <Text style={styles.err}>{error}</Text>
          ) : null}
        </View>

        {devOtp ? (
          <PressableScale onPress={() => onChange(devOtp)} style={styles.dev}>
            <Ionicons
              name="construct-outline"
              size={16}
              color={colors.goldDeep}
            />
            <Text style={styles.devText}>
              Development mode · tap to fill{" "}
              <Text style={{ fontWeight: "800" }}>{devOtp}</Text>
            </Text>
          </PressableScale>
        ) : null}

        <View style={{ alignItems: "center", marginTop: 26 }}>
          {secs > 0 ? (
            <Text style={styles.timer}>
              Resend code in{" "}
              <Text style={{ fontWeight: "800", color: colors.ink }}>
                0:{String(secs).padStart(2, "0")}
              </Text>
            </Text>
          ) : (
            <Button
              title="Resend OTP"
              variant="ghost"
              small
              onPress={resend}
              loading={resending}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: fonts.serif,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontSize: 32,
    color: brand.ink,
    marginTop: 8,
  },
  sub: { color: colors.muted, fontSize: 14.5, marginTop: 10 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  phone: { fontSize: 17, fontWeight: "800", color: colors.ink },
  edit: { color: brand.violet, fontWeight: "800", fontSize: 13.5 },
  boxesWrap: { marginTop: 32, height: 60 },
  boxes: { flexDirection: "row", justifyContent: "space-between" },
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
    width: 48,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.95)",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glass,
  },
  boxGlow: {
    shadowColor: brand.violet,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  digit: { fontSize: 26, fontWeight: "800", color: colors.ink },
  caret: {
    position: "absolute",
    width: 2,
    height: 26,
    backgroundColor: brand.violet,
    borderRadius: 1,
  },
  status: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  err: {
    color: colors.error,
    fontWeight: "700",
    fontSize: 13.5,
    textAlign: "center",
  },
  verifying: { color: colors.muted, fontWeight: "600" },
  okRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  okCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  okText: { color: colors.success, fontWeight: "800", fontSize: 16 },
  dev: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    backgroundColor: "rgba(253, 248, 237, 0.92)",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(212, 160, 23, 0.45)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 8,
    ...shadow.glass,
  },
  devText: { color: colors.text, fontSize: 12.5 },
  timer: { color: colors.muted, fontSize: 14 },
});
