import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Screen from "../components/Screen";
import Button from "../components/Button";
import Logo from "../components/Logo";
import GlassView from "../components/GlassView";
import IndiaFlag from "../components/IndiaFlag";
import OnboardingBackdrop from "../components/OnboardingBackdrop";
import PressableScale from "../components/PressableScale";
import { useEntrance } from "../hooks/useEntrance";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { useAuth } from "../context/AuthContext";
import exitAuthFlow from "../navigation/exitAuthFlow";
import { api } from "../services/api";
import {
  cleanDigits,
  isValidIndianMobile,
  phoneError,
} from "../utils/validators";
import { formatMobileInput } from "../utils/format";
import { brand, colors, fonts, gradients, radius, surfaces } from "../theme";

// `id` is what the rest of the flow expects: Owner/Broker sign in with a phone OTP
// (and become the matching `purpose` after verification); Developer uses the
// builder-portal email + password sign-in.
const ROLES = [
  { id: "Owner", title: "Owner", subtitle: "List, Buy or Rent", icon: "home-outline" },
  { id: "Broker", title: "Broker", subtitle: "Connect Clients", icon: "briefcase-outline" },
  { id: "Developer", title: "Developer", subtitle: "Build & Sell", icon: "business-outline" },
];

function RoleCard({ role, active, onPress }) {
  const s = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (isReducedMotion()) {
      s.setValue(active ? 1 : 0);
      return;
    }
    Animated.spring(s, { toValue: active ? 1 : 0, useNativeDriver: true, friction: 7, tension: 120 }).start();
  }, [active, s]);
  const lift = s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  return (
    <Animated.View style={[styles.roleCell, { transform: [{ scale: lift }] }]}>
      <PressableScale
        onPress={onPress}
        to={0.97}
        style={[styles.roleCard, active && styles.roleCardActive]}
        accessibilityRole="radio"
        accessibilityState={{ selected: active, checked: active }}
        accessibilityLabel={`${role.title}, ${role.subtitle}`}
      >
        <Animated.View style={[styles.roleCheck, { opacity: s, transform: [{ scale: s }] }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </Animated.View>
        {active ? (
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.roleIcon}>
            <Ionicons name={role.icon} size={24} color="#FFFFFF" />
          </LinearGradient>
        ) : (
          <View style={[styles.roleIcon, styles.roleIconIdle]}>
            <Ionicons name={role.icon} size={24} color={brand.violet} />
          </View>
        )}
        <Text style={[styles.roleTitle, active && { color: brand.violet }]} numberOfLines={1}>
          {role.title}
        </Text>
        <Text style={styles.roleSub} numberOfLines={1} adjustsFontSizeToFit>
          {role.subtitle}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

function Field({ label, error, focused, children }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>{children}</View>
      {error ? (
        <Text style={styles.fieldErrorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const { continueAsGuest, signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState("Owner");

  // Phone / OTP state. Errors only show after the user leaves the field or submits.
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  // Developer email & password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [devTouched, setDevTouched] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const inFlight = useRef(false);

  const scrollRef = useRef(null);
  const panelY = useRef(0);
  const fieldFocused = useRef(false);
  const passwordRef = useRef(null);

  const a = useEntrance(0);
  const b = useEntrance(90);
  const c = useEntrance(180);

  const isDev = selectedRole === "Developer";
  const canGoBack = navigation.canGoBack();

  const phoneErrText = phoneTouched ? phoneError(phone) : "";
  const isPhoneValid = isValidIndianMobile(phone);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const emailErr = devTouched && !isEmailValid ? "Enter a valid work email address" : "";
  const passwordErr = devTouched && !isPasswordValid ? "Password must be at least 6 characters" : "";

  // Expo SDK 54 renders Android edge-to-edge, so the window no longer resizes for the keyboard.
  // The KeyboardAvoidingView below shrinks the viewport; once the keyboard is fully open we
  // bring the verification panel (and the focused field inside it) to the top of what's visible.
  const scrollToPanel = () =>
    scrollRef.current?.scrollTo({ y: Math.max(panelY.current - 8, 0), animated: true });

  useEffect(() => {
    const evt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(evt, () => {
      if (fieldFocused.current) requestAnimationFrame(scrollToPanel);
    });
    return () => sub.remove();
  }, []);

  // Also covers moving between fields while the keyboard is already open.
  const revealForm = () => {
    fieldFocused.current = true;
    if (Keyboard.isVisible()) scrollToPanel();
  };
  const fieldBlurred = () => {
    fieldFocused.current = false;
  };

  const handleSkip = async () => {
    try {
      await continueAsGuest();
      exitAuthFlow(navigation);
    } catch (e) {
      setApiError(e?.message || "Couldn't continue as guest. Please try again.");
    }
  };

  const handleRoleSelect = (roleId) => {
    if (loading) return;
    setSelectedRole(roleId);
    setApiError("");
    setPhoneTouched(false);
    setDevTouched(false);
  };

  const submitPhoneOtp = async () => {
    setPhoneTouched(true);
    if (!isPhoneValid || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setApiError("");
    const digits = cleanDigits(phone);
    const role = selectedRole.toLowerCase();
    try {
      const r = await api.sendOtp(digits);
      navigation.navigate("Otp", {
        phone: digits,
        role,
        devOtp: r.devOtp || null,
        resendIn: r.resendInSeconds ?? 30,
        expiresIn: r.expiresInSeconds ?? 300,
      });
    } catch (e) {
      // A resend cooldown means a still-valid code was sent moments ago, so continue to it.
      if (e.status === 429 && e.retryAfterSeconds) {
        navigation.navigate("Otp", { phone: digits, role, devOtp: null, resendIn: e.retryAfterSeconds, expiresIn: 300 });
      } else {
        setApiError(e.message || "Failed to send verification code");
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const submitDeveloperLogin = async () => {
    setDevTouched(true);
    if (!isEmailValid || !isPasswordValid || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setApiError("");
    try {
      const res = await api.signin({ email: email.trim().toLowerCase(), password });
      if (res?.token && res?.user) {
        await signIn(res.token, res.user);
        exitAuthFlow(navigation);
      } else {
        setApiError("Authentication failed. Please check your credentials.");
      }
    } catch (e) {
      setApiError(e.message || "Invalid developer email or password");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} padTop={false} padBottom={false} style={styles.screen}>
      <OnboardingBackdrop imageHeight={300} imageWidth={0.6} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            {canGoBack ? (
              <PressableScale
                onPress={() => navigation.goBack()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <GlassView level="regular" blur borderRadius={22} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={22} color={brand.ink} />
                </GlassView>
              </PressableScale>
            ) : (
              <View style={{ width: 44 }} />
            )}
            <PressableScale
              onPress={handleSkip}
              style={styles.skipPill}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              accessibilityHint="Browse as a guest without signing in"
            >
              <Text style={styles.skipText}>Skip</Text>
              <Ionicons name="arrow-forward" size={15} color={brand.gold} />
            </PressableScale>
          </View>

          <Animated.View style={[styles.hero, a]}>
            <Logo tone="dark" size={34} wordSize={18} />
            <Text style={styles.h1} accessibilityRole="header">
              Welcome to{"\n"}Compare <Text style={{ color: brand.violet }}>Projects</Text>
            </Text>
            <Text style={styles.subtitle}>
              Select your account profile to access verified projects, pricing, and insights.
            </Text>
          </Animated.View>

          <Animated.View style={b}>
            <Text style={styles.sectionLabel}>CHOOSE ACCOUNT TYPE</Text>
            <View style={styles.roleGrid} accessibilityRole="radiogroup">
              {ROLES.map((r) => (
                <RoleCard key={r.id} role={r} active={selectedRole === r.id} onPress={() => handleRoleSelect(r.id)} />
              ))}
            </View>
          </Animated.View>

          <Animated.View style={c} onLayout={(e) => (panelY.current = e.nativeEvent.layout.y)}>
            <GlassView level="strong" borderRadius={radius.xl} style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelTab}>
                  <Ionicons name={isDev ? "business-outline" : "phone-portrait-outline"} size={15} color={brand.violet} />
                  <Text style={styles.panelTabText}>{isDev ? "DEVELOPER SIGN IN" : "MOBILE VERIFICATION"}</Text>
                </View>
                <Text style={styles.panelHint}>{isDev ? "Builder Portal" : "Instant & Secure OTP"}</Text>
              </View>
              <View style={styles.panelRule}>
                <View style={styles.panelRuleActive} />
              </View>

              {isDev ? (
                <View style={{ gap: 14 }}>
                  <Field label="Work Email" error={emailErr} focused={focusedField === "email"}>
                    <Ionicons name="mail-outline" size={19} color={brand.inkSoft} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setApiError("");
                      }}
                      onFocus={() => {
                        setFocusedField("email");
                        revealForm();
                      }}
                      onBlur={() => {
                        setFocusedField(null);
                        fieldBlurred();
                      }}
                      placeholder="name@company.com"
                      placeholderTextColor={brand.placeholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      accessibilityLabel="Work email"
                      editable={!loading}
                    />
                  </Field>
                  <Field label="Password" error={passwordErr} focused={focusedField === "password"}>
                    <Ionicons name="lock-closed-outline" size={19} color={brand.inkSoft} style={{ marginRight: 10 }} />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        setApiError("");
                      }}
                      onFocus={() => {
                        setFocusedField("password");
                        revealForm();
                      }}
                      onBlur={() => {
                        setFocusedField(null);
                        fieldBlurred();
                      }}
                      placeholder="Enter your password"
                      placeholderTextColor={brand.placeholder}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      returnKeyType="done"
                      onSubmitEditing={submitDeveloperLogin}
                      accessibilityLabel="Password"
                      editable={!loading}
                    />
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      hitSlop={12}
                      style={styles.eyeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    >
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={brand.inkSoft} />
                    </Pressable>
                  </Field>

                  {__DEV__ ? (
                    // Development builds only: never ship pre-filled credentials.
                    <Pressable
                      onPress={() => {
                        setEmail("developer@godrej.com");
                        setPassword("DeveloperPassword123!");
                        setApiError("");
                      }}
                      style={styles.demoFill}
                      accessibilityRole="button"
                    >
                      <Ionicons name="construct-outline" size={14} color={brand.deep} />
                      <Text style={styles.demoFillText}>Dev only · fill demo developer credentials</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Field label="Mobile Number" error={phoneErrText} focused={phoneFocused}>
                  <View style={styles.country} accessible accessibilityLabel="Country code India, plus 91">
                    <IndiaFlag width={24} />
                    <Text style={styles.countryText}>+91</Text>
                  </View>
                  <View style={styles.divider} />
                  <TextInput
                    style={styles.input}
                    value={formatMobileInput(phone)}
                    onChangeText={(t) => {
                      setPhone(cleanDigits(t).slice(0, 10));
                      setApiError("");
                    }}
                    onFocus={() => {
                      setPhoneFocused(true);
                      revealForm();
                    }}
                    onBlur={() => {
                      setPhoneFocused(false);
                      fieldBlurred();
                      if (phone.length > 0) setPhoneTouched(true);
                    }}
                    keyboardType="number-pad"
                    maxLength={11}
                    placeholder="Enter 10-digit mobile number"
                    placeholderTextColor={brand.placeholder}
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    returnKeyType="done"
                    onSubmitEditing={submitPhoneOtp}
                    accessibilityLabel="Mobile number"
                    editable={!loading}
                  />
                </Field>
              )}

              {apiError ? (
                <View style={styles.errorBox} accessibilityLiveRegion="assertive" accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={styles.errorText}>{apiError}</Text>
                </View>
              ) : null}

              <Button
                title={isDev ? "Sign In as Developer" : "Send Verification Code"}
                icon={isDev ? "log-in-outline" : "paper-plane-outline"}
                onPress={isDev ? submitDeveloperLogin : submitPhoneOtp}
                loading={loading}
                style={{ marginTop: 18 }}
              />

              <Text style={styles.legal}>
                {isDev
                  ? "The builder portal gives you direct project listing, inventory management and lead enquiries."
                  : "By continuing, you agree to receive a one-time verification SMS. Standard carrier charges may apply."}
              </Text>
            </GlassView>
          </Animated.View>

          {/* Kept to what the platform actually does: listings are moderated and sign-in is OTP-verified. */}
          <View style={styles.trust}>
            <View style={styles.trustLine} />
            <Ionicons name="shield-checkmark-outline" size={15} color={brand.violet} />
            <Text style={styles.trustText}>Moderated Listings • Secure OTP Verification</Text>
            <View style={styles.trustLine} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Edge-to-edge: fade content out under the status bar so it never collides with the clock. */}
      <LinearGradient
        pointerEvents="none"
        colors={["#FBF9FF", "rgba(251,249,255,0.92)", "rgba(251,249,255,0)"]}
        locations={[0, 0.6, 1]}
        style={[styles.statusScrim, { height: insets.top + 28 }]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: brand.bg },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  scroll: { paddingHorizontal: 18 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  skipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.2,
    borderColor: brand.goldBorder,
  },
  skipText: { fontSize: 14.5, fontWeight: "700", color: brand.ink },
  hero: { marginTop: 18, marginBottom: 22 },
  h1: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    color: brand.ink,
    letterSpacing: -0.8,
    marginTop: 18,
  },
  subtitle: { fontSize: 15, lineHeight: 22, color: brand.inkSoft, marginTop: 10, maxWidth: 330 },
  sectionLabel: { fontSize: 11.5, fontWeight: "700", letterSpacing: 2, color: brand.inkSoft, marginBottom: 12 },
  roleGrid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  roleCell: { flex: 1 },
  roleCard: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    ...surfaces.glass,
    borderColor: "#ECE4FB",
    shadowColor: brand.deep,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    // Android draws elevation shadows through translucent backgrounds (a visible box inside
    // the card), so idle glass cards only get the iOS shadow.
    elevation: 0,
  },
  roleCardActive: {
    backgroundColor: "#FFFFFF",
    borderColor: brand.violet,
    borderWidth: 1.6,
    shadowColor: brand.violet,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  roleCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  roleIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  roleIconIdle: { backgroundColor: brand.lavender },
  roleTitle: { fontSize: 15, fontWeight: "800", color: brand.ink },
  roleSub: { fontSize: 12, color: brand.inkSoft, marginTop: 3 },
  panel: { padding: 18 },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: brand.lavender,
  },
  panelTabText: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.8, color: brand.violet },
  panelHint: { fontSize: 12.5, color: brand.inkSoft, fontWeight: "500" },
  panelRule: { height: 2, backgroundColor: "#F1ECFB", borderRadius: 1, marginTop: 12, marginBottom: 18 },
  panelRuleActive: { width: "48%", height: 2, borderRadius: 1, backgroundColor: brand.violet },
  fieldLabel: { fontSize: 13.5, fontWeight: "700", color: brand.ink, marginBottom: 8 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    ...surfaces.field,
  },
  fieldFocused: { borderColor: brand.violet, backgroundColor: "#FFFFFF" },
  fieldError: { borderColor: colors.error },
  fieldErrorText: { color: colors.error, fontSize: 12.5, fontWeight: "600", marginTop: 6 },
  country: { flexDirection: "row", alignItems: "center", gap: 8 },
  countryText: { fontSize: 15.5, fontWeight: "700", color: brand.ink },
  divider: { width: 1, height: 24, backgroundColor: "#DDD3F2", marginHorizontal: 12 },
  input: { flex: 1, minHeight: 52, fontSize: 16, color: brand.ink, fontWeight: "600", letterSpacing: 0.3 },
  eyeBtn: { paddingLeft: 10, minHeight: 44, justifyContent: "center" },
  demoFill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(76,22,184,0.3)",
  },
  demoFillText: { color: brand.deep, fontSize: 12.5, fontWeight: "700" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginTop: 14,
    borderRadius: radius.md,
    backgroundColor: brand.errorSoft,
    borderWidth: 1,
    borderColor: brand.errorBorder,
  },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: "600" },
  legal: { fontSize: 12, lineHeight: 17, color: brand.inkSoft, textAlign: "center", marginTop: 14 },
  trust: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 },
  trustLine: { flex: 1, height: 1, backgroundColor: "#E4DAF7", maxWidth: 40 },
  trustText: { fontSize: 12, color: brand.inkSoft, fontWeight: "600" },
});
