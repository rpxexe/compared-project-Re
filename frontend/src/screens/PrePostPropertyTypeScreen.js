import React, { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import ScreenHeader from "../components/ScreenHeader";
import Input from "../components/Input";
import Button from "../components/Button";
import FilterChip from "../components/FilterChip";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { validatePost, isValidIndianMobile } from "../utils/validators";
import { colors, fonts, radius } from "../theme";
export default function PrePostPropertyTypeScreen({ navigation }) {
  const [isDeveloper, setIsDeveloper] = useState(true);
  const scroll = useRef(null);
  const handlePostType = (data) => {
    if (data) {
      setIsDeveloper(true);
      navigation.navigate("PostPropertyForm");
    } else {
      setIsDeveloper(false);
      navigation.navigate("PostPropertyForm");
    }
  };

  return (
    <Screen keyboard scrollRef={scroll}>
      <ScreenHeader
        title="Post Property"
        subtitle="Reach serious buyers in minutes"
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            width: 275,
            marginHorizontal: "auto",
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <Button
            title="Developer"
            small
            variant={isDeveloper ? "dark" : "ghost"}
            onPress={() => handlePostType(true)}
            style={{
              marginHorizontal: 5,
              marginTop: 5,
              width: 125,
            }}
          />
          <Button
            title="Broker"
            small
            variant={!isDeveloper ? "dark" : "ghost"}
            onPress={() => handlePostType(false)}
            style={{
              marginHorizontal: 5,
              marginTop: 5,
              width: 125,
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
