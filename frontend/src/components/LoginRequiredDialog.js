import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import PressableScale from "./PressableScale";
import Button from "./Button";
import { colors, fonts, radius, shadow, glow } from "../theme";
import Text from "./AppText";

export default function LoginRequiredDialog({ navigationRef }) {
  const { loginPrompt, closeLoginPrompt } = useAuth();
  const visible = !!loginPrompt?.visible;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.88,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleSignIn = () => {
    closeLoginPrompt();
    if (navigationRef?.isReady?.()) {
      navigationRef.navigate("Login");
    }
  };

  const isEnquiry = loginPrompt.reason === "enquiry";
  const isPost = loginPrompt.reason === "post_property";

  const iconName = isEnquiry
    ? "chatbubbles-outline"
    : isPost
    ? "home-outline"
    : "person-circle-outline";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={closeLoginPrompt}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Pressable
            style={styles.backdrop}
            onPress={closeLoginPrompt}
            accessibilityLabel="Close dialog"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Frosted Glass Layers */}
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.96)", "rgba(246, 242, 255, 0.9)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.85)", "rgba(255, 255, 255, 0.15)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
            pointerEvents="none"
          />

          {/* Top Close button */}
          <PressableScale
            onPress={closeLoginPrompt}
            to={0.88}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={19} color={colors.ink} />
          </PressableScale>

          {/* Luxury Badge Icon */}
          <LinearGradient
            colors={["#C9A2FF", colors.gold, "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.iconCircle, glow]}
          >
            <Ionicons name={iconName} size={28} color={colors.white} />
          </LinearGradient>

          {/* Title & Description */}
          <Text style={styles.title}>{loginPrompt.title}</Text>
          <Text style={styles.message}>{loginPrompt.message}</Text>

          {/* Trust points in frosted glass box */}
          <View style={styles.perks}>
            <LinearGradient
              colors={["rgba(246, 242, 255, 0.8)", "rgba(235, 226, 255, 0.6)"]}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]}
              pointerEvents="none"
            />
            <View style={styles.perkRow}>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={colors.goldDeep}
              />
              <Text style={styles.perkText}>
                {isEnquiry
                  ? "Direct connection with RERA verified builders"
                  : isPost
                  ? "Free listing to thousands of genuine buyers"
                  : "Verified buyers, sellers, and premier projects"}
              </Text>
            </View>
            <View style={styles.perkRow}>
              <Ionicons name="flash-outline" size={16} color={colors.goldDeep} />
              <Text style={styles.perkText}>
                Instant OTP or developer password login
              </Text>
            </View>
          </View>

          {/* Action CTAs */}
          <View style={styles.actions}>
            <Button
              title="Sign In / Register"
              onPress={handleSignIn}
              icon="log-in-outline"
              style={{ width: "100%" }}
            />
            <Button
              title="Continue Browsing"
              variant="glass"
              onPress={closeLoginPrompt}
              style={{ width: "100%", marginTop: 8 }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");
const CARD_W = Math.min(width - 44, 380);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(11, 4, 32, 0.68)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: CARD_W,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: radius.xl,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
    ...shadow.glassFloat,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(235, 226, 255, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.9)",
    zIndex: 1,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    textAlign: "center",
    marginBottom: 8,
    zIndex: 1,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  perks: {
    width: "100%",
    backgroundColor: "rgba(246, 242, 255, 0.7)",
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    gap: 8,
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 1,
  },
  perkText: {
    flex: 1,
    fontSize: 12,
    color: colors.charcoal,
    fontWeight: "500",
  },
  actions: {
    width: "100%",
    zIndex: 1,
  },
});
