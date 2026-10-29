import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme";

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    prefix,
    style,
    multiline,
    inputStyle,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const inner = useRef(null);
  useImperativeHandle(ref, () => ({
    focus: () => inner.current?.focus(),
    blur: () => inner.current?.blur(),
  }));
  const border = error ? colors.error : focused ? colors.gold : "rgba(225, 216, 245, 0.9)";
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => inner.current?.focus()}
        style={[
          styles.box,
          {
            borderColor: border,
            backgroundColor: focused ? "rgba(255, 255, 255, 0.95)" : "rgba(251, 249, 255, 0.75)",
          },
          focused && styles.glow,
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={inner}
          placeholderTextColor="#A9A3B0"
          style={[
            styles.input,
            multiline && {
              minHeight: 92,
              textAlignVertical: "top",
              paddingTop: 14,
            },
            inputStyle,
          ]}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </Pressable>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 7,
    letterSpacing: 0.6,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  glow: {
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  prefix: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    marginRight: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 10,
  },
  error: { color: colors.error, fontSize: 12, marginTop: 6, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
