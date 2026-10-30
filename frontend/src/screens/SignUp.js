import React, { useState } from "react";
import { Pressable, StyleSheet, View, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Input from "../components/Input";
import Button from "../components/Button";
import { LogoMark } from "../components/Logo";
import { useEntrance } from "../hooks/useEntrance";
import FilterChip from "../components/FilterChip";
import { api } from "../services/api";
import { cleanDigits, isValidIndianMobile, EMAIL } from "../utils/validators";
import { colors, fonts } from "../theme";
import { useAuth } from "../context/AuthContext";
import Text, { AnimatedText } from "../components/AppText";

export default function SignUpScreen({ navigation }) {
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSignin, setIsSignin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const { signIn } = useAuth();

  const a = useEntrance(0);
  const b = useEntrance(120);
  const c = useEntrance(220);
  const CRITERIA = ["Owner", "Broker", "Developer"];

  const submit = async () => {
    console.log("1232121");
    if (loading) return;
    setApiError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL.test(normalizedEmail)) {
      setApiError("Please enter a valid email address");
      return;
    }
    if (!password) {
      setApiError("Please enter your password");
      return;
    }
    if (!isSignin) {
      if (parseInt(fullName.length) < 2) {
        console.log(parseInt(fullName.length) < 2);
        setApiError("Please enter your full name");
        return;
      }
      if (password.length < 8) {
        setApiError("Password must contain at least 8 characters");
        return;
      }
      if (password !== confirmPassword) {
        setApiError("Passwords do not match");
        return;
      }
      if (phone && !isValidIndianMobile(phone)) {
        setApiError("Please enter a valid 10-digit mobile number");
        return;
      }
    }
    console.log("test");
    setLoading(true);
    try {
      const result = isSignin
        ? await api.signin({ email: normalizedEmail, password })
        : await api.signup({
            fullName: fullName.trim(),
            phone: cleanDigits(phone),
            email: normalizedEmail,
            password,
          });
      await signIn(result.token, result.user);
      console.log(result);

      // navigation.navigate("Home");
      let token = result.token;
      let user = result.user;
      navigation.replace("AuthWelcome", { token, user });
    } catch (error) {
      console.log(error.message);
      setApiError(
        error.message || (isSignin ? "Sign in failed" : "Sign up failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <ScreenHeader title=" " back style={{ marginBottom: 8 }} />
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Animated.View style={a}>
          <LogoMark size={60} tone="dark" />
        </Animated.View>
        <AnimatedText style={[styles.h1, b]}>
          {isSignin ? "Welcome back" : "Welcome Sign Up"}
          {"\n"}to Compare Project
        </AnimatedText>

        <Pressable
          onPress={() => {
            setIsSignin((value) => !value);
            setApiError("");
          }}
          style={{ alignSelf: "flex-start", marginTop: 12, marginBottom: 20 }}
        >
          <Text style={styles.switchText}>
            {isSignin
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>

        {!isSignin && (
          <>
            <Text style={styles.lbl}>WHO YOU ARE</Text>
            <View style={styles.wrap}>
              {CRITERIA.map((item, index) => (
                <FilterChip
                  key={item}
                  label={item}
                  active={currentIndex === index}
                  onPress={() => setCurrentIndex(index)}
                />
              ))}
            </View>
            <Animated.View style={[{ marginTop: 24 }, c]}>
              <Input
                label="FULL NAME"
                value={fullName}
                onChangeText={(value) => setFullName(value)}
                maxLength={60}
                placeholder="Full name"
                autoCapitalize="words"
                textContentType="name"
                returnKeyType="next"
              />
            </Animated.View>
            <Animated.View style={[{ marginTop: 20 }, c]}>
              <Input
                label="MOBILE NUMBER (OPTIONAL)"
                prefix="+91"
                value={phone}
                onChangeText={(value) =>
                  setPhone(cleanDigits(value).slice(0, 10))
                }
                keyboardType="number-pad"
                maxLength={10}
                placeholder="98765 43210"
                textContentType="telephoneNumber"
              />
            </Animated.View>
          </>
        )}

        <Animated.View style={[{ marginTop: 20 }, c]}>
          <Input
            label="EMAIL ID"
            value={email}
            onChangeText={(value) => setEmail(value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={80}
            placeholder="Email address"
            textContentType="emailAddress"
          />
        </Animated.View>
        <Animated.View style={[{ marginTop: 20 }, c]}>
          <Input
            label="PASSWORD"
            value={password}
            onChangeText={(value) => setPassword(value)}
            secureTextEntry
            autoCapitalize="none"
            maxLength={128}
            placeholder={
              isSignin ? "Enter your password" : "At least 8 characters"
            }
            textContentType={isSignin ? "password" : "newPassword"}
            returnKeyType={isSignin ? "done" : "next"}
            onSubmitEditing={isSignin ? submit : undefined}
          />
        </Animated.View>
        {!isSignin && (
          <Animated.View style={[{ marginTop: 20 }, c]}>
            <Input
              label="CONFIRM PASSWORD"
              value={(value) => confirmPassword}
              onChangeText={(value) => setConfirmPassword(value)}
              secureTextEntry
              autoCapitalize="none"
              maxLength={128}
              placeholder="Re-enter password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </Animated.View>
        )}

        {apiError ? (
          <View style={styles.apiErr}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.apiErrText}>{apiError}</Text>
          </View>
        ) : null}

        <Button
          title={isSignin ? "Sign In" : "Create Account"}
          onPress={submit}
          loading={loading}
          style={{ marginTop: 24 }}
        />
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
  switchText: { color: colors.goldDeep, fontWeight: "700", fontSize: 14 },
  lbl: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
});
