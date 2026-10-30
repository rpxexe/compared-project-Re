import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Button from "../components/Button";
import PressableScale from "../components/PressableScale";
import Input from "../components/Input";
import { useEntrance } from "../hooks/useEntrance";
import { api, session } from "../services/api";
import { brand, colors, fonts, radius, shadow } from "../theme";
import Text from "../components/AppText";

export const PURPOSES = [
  {
    key: "buyer",
    label: "Buyer",
    note: "Looking for a home or project to buy",
    icon: "key-outline",
  },
  {
    key: "investor",
    label: "Investor",
    note: "Compare projects for returns",
    icon: "trending-up-outline",
  },
  {
    key: "owner",
    label: "Owner / Seller",
    note: "List my own property",
    icon: "home-outline",
  },
  {
    key: "resale",
    label: "Resale",
    note: "Buy or sell a resale property",
    icon: "swap-horizontal",
  },
  {
    key: "broker",
    label: "Broker",
    note: "Post and manage listings for clients",
    icon: "briefcase-outline",
  },
];

function Card({ item, selected, onPress, delay }) {
  const enter = useEntrance(delay, 20);
  const s = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(s, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [selected, s]);
  return (
    <Animated.View style={enter}>
      <PressableScale
        onPress={onPress}
        to={0.97}
        style={[styles.card, selected && styles.on]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <View
          style={[styles.icon, selected && { backgroundColor: brand.violet }]}
        >
          <Ionicons
            name={item.icon}
            size={22}
            color={selected ? colors.white : brand.violet}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, selected && { color: brand.violet }]}>
            {item.label}
          </Text>
          <Text style={styles.note}>
            {item.note}
          </Text>
        </View>
        <Animated.View
          style={[styles.tick, { opacity: s, transform: [{ scale: s }] }]}
        >
          <Ionicons name="checkmark" size={15} color={colors.white} />
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

export default function RoleScreen({ navigation, route }) {
  const { token, user, suggestedPurpose } = route.params;
  // Preselect the account type chosen on the login screen when it maps to a known purpose.
  const [purpose, setPurpose] = useState(
    PURPOSES.some((p) => p.key === suggestedPurpose) ? suggestedPurpose : null,
  );
  const [name, setName] = useState(user.name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!purpose) {
      setError("Choose what brings you here");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const patch = { purpose };
      if (name.trim()) patch.name = name.trim();
      const { user: updated } = await api.updateMe(patch);
      await session.save(token, updated);
      navigation.replace("AuthWelcome", { token, user: updated });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
        <Text style={styles.h1}>What brings you to{"\n"}Compare Projects?</Text>
        <Text style={styles.sub}>
          We tailor the app to how you use it. You can change this later in
          Profile.
        </Text>
        <Input
          label="YOUR NAME (OPTIONAL)"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Asha Rao"
          maxLength={80}
          autoCapitalize="words"
          style={{ marginTop: 20 }}
        />
        <View style={{ gap: 10, marginTop: 20 }}>
          {PURPOSES.map((p, i) => (
            <Card
              key={p.key}
              item={p}
              delay={i * 60}
              selected={purpose === p.key}
              onPress={() => {
                setPurpose(p.key);
                setError("");
              }}
            />
          ))}
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Button
          title="Continue"
          onPress={save}
          loading={loading}
          style={{ marginTop: 22 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: fonts.serif,
    fontWeight: "700",
    fontSize: 31,
    lineHeight: 38,
    color: colors.ink,
  },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#ECE4FB",
    ...shadow.glass,
  },
  on: {
    backgroundColor: colors.white,
    borderColor: brand.violet,
    shadowColor: brand.violet,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: brand.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  note: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  err: {
    color: colors.error,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
});
