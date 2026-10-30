import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Input from "../components/Input";
import Button from "../components/Button";
import { LogoMark } from "../components/Logo";
import { useEntrance } from "../hooks/useEntrance";
import { api } from "../services/api";
import {
  cleanDigits,
  isValidIndianMobile,
  phoneError,
} from "../utils/validators";
import { colors, fonts } from "../theme";
import { Animated } from "react-native";
import FilterChip from "../components/FilterChip";
import { EMAIL } from "../utils/validators";
import Text, { AnimatedText } from "../components/AppText";

export default function SignUpScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmpassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPreLogin, setIsPreLogin] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(false);
  const [userTitle, setUserTitle] = useState("");
  const [apiError, setApiError] = useState("");

  // useEffect(() => {
  //   const t = setTimeout(() => field.current?.focus(), 700);
  //   return () => clearTimeout(t);
  // }, []);
  const a = useEntrance(0);
  const b = useEntrance(120);
  const c = useEntrance(220);

  const err = touched ? phoneError(phone) : "";
  const valid = isValidIndianMobile(phone);

  const submit = async () => {
    if(password !== confirmpassword) return
    setTouched(true);
    if (!valid || loading) return;
    setLoading(true);
    setApiError("");
    try {
      const data = {
        fullName,
        phone,
        email,
        password
      }
      const r = await api.signup();
      navigation.navigate("Otp", {
        phone: cleanDigits(phone),
        devOtp: r.devOtp || null,
        resendIn: r.resendInSeconds ?? 30,
        expiresIn: r.expiresInSeconds ?? 300,
      });
    } catch (e) {
      if (e.status === 429 && e.retryAfterSeconds)
        navigation.navigate("Otp", {
          phone: cleanDigits(phone),
          devOtp: null,
          resendIn: e.retryAfterSeconds,
          expiresIn: 300,
        });
      else setApiError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreLogin = (title, index) => {
    setUserTitle(title);
    setCurrentIndex(index);
    setIsPreLogin(true);
    ``;
  };

  const CRITERIA = ["Owner", "Broker", "Developer"];

  const [emailErrorText, setEmailErrorText] = useState("");
  const isValidEmail = (data) => {
    const email = EMAIL.test(data);
    console.log(data);
    console.log(email);
    if (email) {
      setEmail(data);
      setEmailError(false);
      setEmailErrorText("");
    } else {
      setEmailError(true);
      setEmailErrorText("Please enter valid email");
    }
  };

  return (
    <Screen keyboard>
      <ScreenHeader title=" " back style={{ marginBottom: 8 }} />
      <View style={{ paddingHorizontal: 24 }}>
        <Animated.View style={a}>
          <LogoMark size={60} tone="dark" />
        </Animated.View>
        <AnimatedText style={[styles.h1, b]}>
          Welcome Sign Up{"\n"}to Compare Project
        </AnimatedText>
        <View style={styles.gap} />
        <Text style={styles.lbl}>Who you are</Text>
        <View style={styles.wrap}>
          {CRITERIA.map((x, index) => (
            <FilterChip
              key={x}
              label={x}
              active={currentIndex === index}
              onPress={() => handlePreLogin(x, index)}
            />
          ))}
        </View>
        {isPreLogin && (
          <>
            {/* <AnimatedText style={[styles.sub, b]}>
              Enter your mobile number.
            </AnimatedText> */}
            <Animated.View style={[{ marginTop: 28 }, c]}>
              <Input
                label="MOBILE NUMBER"
                prefix="+91"
                onChangeText={(t) => {
                  setPhone(cleanDigits(t).slice(0, 10));
                  setApiError("");
                }}
                onBlur={() => setTouched(true)}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="98765 43210"
                textContentType="telephoneNumber"
                autoComplete="tel"
                error={err}
                returnKeyType="done"
              />
              {/* {apiError ? (
                <View style={styles.apiErr}>
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={colors.error}
                  />
                  <Text style={styles.apiErrText}>{apiError}</Text>
                </View>
              ) : null} */}
            </Animated.View>
            {/* <AnimatedText style={[styles.sub, b]}>
              Enter your Full Name.
            </AnimatedText> */}
            <Animated.View style={[{ marginTop: 28 }, c]}>
              <Input
                label="FULL NAME"
                onChangeText={(t) => {
                  setFullName(t);
                  setApiError("");
                }}
                onBlur={() => setTouched(true)}
                maxLength={60}
                placeholder="Full Name"
                textContentType="fullName"
                // error={err}
                returnKeyType="done"
              />
            </Animated.View>
            {/* <AnimatedText style={[styles.sub, b]}>
              Enter your Email ID.
            </AnimatedText> */}
            <Animated.View style={[{ marginTop: 28 }, c]}>
              <Input
                label="EMAIL ID"
                onChangeText={(t) => {
                  isValidEmail(t);
                }}
                onBlur={() => setTouched(true)}
                maxLength={80}
                placeholder="Email ID"
                textContentType="emailId"
                error={emailErrorText}
                returnKeyType="done"
              />
              {/* {emailError ? (
                <View style={styles.apiErr}>
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={colors.error}
                  />
                  <Text style={styles.apiErrText}>
                    Please enter valid email id
                  </Text>
                </View>
              ) : null} */}
            </Animated.View>
            {/* <AnimatedText style={[styles.sub, b]}>
              Enter your Password.
            </AnimatedText> */}
            <Animated.View style={[{ marginTop: 28 }, c]}>
              <Input
                label="PASSWORD"
                onChangeText={(t) => {
                  setPassword(t);
                  setApiError("");
                }}
                onBlur={() => setTouched(true)}
                maxLength={15}
                placeholder="Password"
                textContentType="password"
                // error={err}
                returnKeyType="done"
              />
            </Animated.View>
            {/* <AnimatedText style={[styles.sub, b]}>
              Confirm Password
            </AnimatedText> */}
            <Animated.View style={[{ marginTop: 28 }, c]}>
              <Input
                label="CONFIRM PASSWORD"
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setApiError("");
                }}
                onBlur={() => setTouched(true)}
                maxLength={80}
                placeholder="Confirm Password"
                textContentType="confirmPassword"
                // error={err}
                returnKeyType="done"
              />
            </Animated.View>
            {/* <Text style={styles.legal}>
              By continuing you agree to receive a one-time verification SMS.
              Standard rates may apply.
            </Text> */}
            <Button
              small
              title="Submit"
              onPress={submit}
              loading={loading}
              style={{ marginHorizontal: "auto", marginTop: 20 }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 39,
    color: colors.ink,
    marginTop: 24,
  },
  sub: { fontSize: 14.5, lineHeight: 22, color: colors.muted, marginTop: 10 },
  apiErr: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F8E6E6",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    alignItems: "center",
  },
  apiErrText: { flex: 1, color: colors.error, fontWeight: "600", fontSize: 13 },
  legal: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 17,
  },
  lbl: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gap: { height: 14 },
});
