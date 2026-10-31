import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Easing, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { isReducedMotion } from "../../hooks/useReducedMotion";
import { useBottomSpace } from "../../hooks/useBottomSpace";
import Logo from "../Logo";
import PressableScale from "../PressableScale";
import { brand, colors, gradients, radius } from "../../theme";
import Text, { AppTextInput as TextInput } from "../AppText";

const BUILDING = require("../../../assets/onboarding_residence.jpg");
export const LINE = "#E6DCFA";
const FIELD_BG = "#FFFFFF";

// Light header: back + logo, the step's heading, and the building artwork fading in from the right.
export function WizardHeader({ title, subtitle, onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View style={[s.header, { paddingTop: insets.top + 6 }]}>
      <View style={[s.headerArt, { width: Math.min(width * 0.5, 260), height: insets.top + 132 }]} pointerEvents="none">
        <Image source={BUILDING} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(190,160,255,0.22)" }]} />
        <LinearGradient colors={[colors.ivory, "rgba(251,249,255,0.4)", "rgba(251,249,255,0)"]} locations={[0, 0.45, 0.9]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(251,249,255,0)", colors.ivory]} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={s.headerRow}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={s.back}>
          <Ionicons name="arrow-back" size={22} color={brand.ink} />
        </Pressable>
        <Logo tone="dark" size={26} wordSize={15} />
      </View>
      <Text style={s.hTitle} accessibilityRole="header">{title}</Text>
      <Text style={s.hSub}>{subtitle}</Text>
    </View>
  );
}

// Numbered steps joined by a line: done steps show a tick, the current one is a filled violet disc.
export function Stepper({ steps, step, onJump }) {
  return (
    <View style={s.stepperWrap} accessibilityLabel={`Step ${step + 1} of ${steps.length}, ${steps[step].title}`}>
      <View style={s.stepper}>
        <View style={s.stepTrack} />
        <View style={[s.stepTrack, s.stepTrackDone, { right: `${(1 - step / (steps.length - 1)) * 100}%` }]} />
        {steps.map((st, i) => {
          const done = i < step;
          const cur = i === step;
          return (
            <Pressable key={st.key} disabled={!done} onPress={() => onJump(i)} hitSlop={6} style={s.stepSlot}
              accessibilityRole="button" accessibilityLabel={`Go to step ${i + 1}, ${st.title}`} accessibilityElementsHidden={!done}>
              {cur ? (
                <LinearGradient colors={gradients.cta} style={s.dotCur}><Text style={s.dotCurText}>{i + 1}</Text></LinearGradient>
              ) : done ? (
                <View style={s.dotDone}><Ionicons name="checkmark" size={12} color={brand.violet} /></View>
              ) : (
                <View style={s.dotTodo}><Text style={s.dotTodoText}>{i + 1}</Text></View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={s.stepMeta}>
        <Text style={s.stepCount}>Step {step + 1} of {steps.length}</Text>
        <Text style={s.stepName} numberOfLines={1}>{steps[step].title}</Text>
      </View>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function FieldLabel({ icon, children, required, right, style }) {
  return (
    <View style={[s.labelRow, style]}>
      {icon ? <View style={s.labelIcon}><Ionicons name={icon} size={15} color={brand.violet} /></View> : null}
      <Text style={s.label}>{children}{required ? <Text style={{ color: colors.error }}> *</Text> : null}</Text>
      {right}
    </View>
  );
}

export const ErrorText = ({ children }) => (children ? <Text style={s.err} accessibilityLiveRegion="polite">{children}</Text> : null);

const optLabel = (o) => (typeof o === "string" ? o : o.label);
const optValue = (o) => (typeof o === "string" ? o : o.value);
// An option's own `icon`, else `optionIcon` (one icon name for all, or value -> icon name).
const optIcon = (o, optionIcon) =>
  (typeof o === "object" && o.icon) || (typeof optionIcon === "function" ? optionIcon(optValue(o)) : optionIcon) || null;

const OPTION_H = 46;
const MENU_MAX_H = 280;
const MENU_MIN_W = 140;

// Dropdown menus draw into this layer at the top of the screen, so they float over the form
// without pushing it down. Fields are measured relative to the host view itself (not the
// window), which keeps the menu glued to its field whatever the status bar is doing.
const DropdownContext = createContext(null);

export function DropdownHost({ children, style }) {
  const root = useRef(null);
  const [layer, setLayer] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const value = useMemo(() => ({ root, setLayer, size }), [size]);
  return (
    <DropdownContext.Provider value={value}>
      <View ref={root} collapsable={false} style={style} onLayout={(e) => setSize(e.nativeEvent.layout)}>
        {children}
        {layer}
      </View>
    </DropdownContext.Provider>
  );
}

function DropdownMenu({ rect, host, options, value, format, optionIcon, title, onChoose, onClose }) {
  const insets = useSafeAreaInsets();
  const { bottom } = useBottomSpace();
  const anim = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const height = Math.min(options.length * OPTION_H + 10, MENU_MAX_H);
  const width = Math.min(Math.max(rect.width, MENU_MIN_W), host.width - 24);
  const left = Math.min(Math.max(rect.x, 12), host.width - width - 12);
  const below = host.height - bottom - (rect.y + rect.height) - 12;
  const up = below < height && rect.y - insets.top > below;
  const place = up ? { bottom: host.height - rect.y + 6 } : { top: rect.y + rect.height + 6 };

  return (
    <View style={s.layer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Close ${title || "options"}`} />
      <Animated.View
        style={[
          s.menu,
          { width, left, maxHeight: height, ...place },
          { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [up ? 6 : -6, 0] }) }] },
        ]}
      >
        <ScrollView bounces={false} showsVerticalScrollIndicator={options.length * OPTION_H + 10 > MENU_MAX_H} keyboardShouldPersistTaps="handled">
          {options.map((o) => {
            const on = optValue(o) === value;
            const ic = optIcon(o, optionIcon);
            return (
              <Pressable key={optValue(o)} onPress={() => onChoose(o)}
                style={({ pressed }) => [s.option, on && s.optionOn, pressed && !on && s.optionPressed]}
                accessibilityRole="button" accessibilityState={{ selected: on }}>
                {ic ? (
                  <View style={[s.optionIcon, on && s.optionIconOn]}>
                    <Ionicons name={ic} size={15} color={on ? "#fff" : brand.violet} />
                  </View>
                ) : null}
                <Text style={[s.optionText, on && s.optionTextOn]} numberOfLines={1}>{format ? format(o) : optLabel(o)}</Text>
                {on ? <Ionicons name="checkmark" size={16} color={brand.violet} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// Select box whose options float just below it (or above it near the bottom of the screen).
// Needs a DropdownHost around the screen; tapping outside the menu closes it.
export function SelectField({ value, options, onChange, placeholder = "Select", title, icon, optionIcon, error, style, format }) {
  const host = useContext(DropdownContext);
  const [rect, setRect] = useState(null); // field position inside the host while open
  const field = useRef(null);
  const open = !!rect;
  const current = options.find((o) => optValue(o) === value);
  const shown = current ? (format ? format(current) : optLabel(current)) : "";
  // icon={false} keeps a narrow box text-only while its menu still shows option icons.
  const fieldIcon = icon === false ? null : icon || (current ? optIcon(current, optionIcon) : null);

  const show = () => {
    if (!host?.root.current || !field.current) return;
    field.current.measureLayout(host.root.current, (x, y, width, height) => setRect({ x, y, width, height }), () => {});
  };

  useEffect(() => {
    if (!host || !rect) return undefined;
    const close = () => setRect(null);
    host.setLayer(
      <DropdownMenu rect={rect} host={host.size} options={options} value={value} format={format} optionIcon={optionIcon} title={title}
        onClose={close} onChoose={(o) => { onChange(optValue(o)); close(); }} />,
    );
    return () => host.setLayer(null);
  }, [rect, host?.size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setRect(null); return true; });
    return () => sub.remove();
  }, [open]);

  return (
    <Pressable ref={field} collapsable={false} onPress={show} style={[s.select, open && s.selectOpen, error && s.fieldErr, style]}
      accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title || placeholder}: ${shown || "not selected"}`}>
      {fieldIcon ? <Ionicons name={fieldIcon} size={17} color={brand.violet} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.selectText, !shown && { color: brand.placeholder }]} numberOfLines={1}>{shown || placeholder}</Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={open ? brand.violet : brand.inkSoft} />
    </Pressable>
  );
}

// A screen's scroll view can provide this so a focused field is scrolled fully clear of the keyboard.
export const KeepVisibleContext = createContext(null);

// Text input in the same box style as SelectField; `label` sits above it when given.
export function TextField({ label, required, error, prefix, style, multiline, ...props }) {
  const [focused, setFocused] = useState(false);
  const keepVisible = useContext(KeepVisibleContext);
  const box = useRef(null);
  return (
    <View style={style}>
      {label ? <Text style={s.smallLabel}>{label}{required ? <Text style={{ color: colors.error }}> *</Text> : null}</Text> : null}
      <View ref={box} collapsable={false} style={[s.select, multiline && s.multiline, focused && s.fieldFocus, error && s.fieldErr]}>
        {prefix ? <View style={s.prefix}><Text style={s.prefixText}>{prefix}</Text></View> : null}
        <TextInput
          placeholderTextColor={brand.placeholder}
          style={[s.input, multiline && { minHeight: 110, textAlignVertical: "top" }]}
          multiline={multiline}
          accessibilityLabel={label}
          onFocus={() => {
            setFocused(true);
            keepVisible?.(box.current);
          }}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

// Big Rent / Sell tile with a tick badge when chosen.
export function ChoiceTile({ label, icon, active, onPress }) {
  return (
    <PressableScale to={0.97} onPress={onPress} style={[s.tile, active && s.tileOn]}
      accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={label}>
      {active ? <View style={s.tileTick}><Ionicons name="checkmark" size={12} color="#fff" /></View> : null}
      <Ionicons name={icon} size={26} color={brand.violet} />
      <Text style={[s.tileText, active && { color: brand.violet }]}>{label}</Text>
    </PressableScale>
  );
}

// Multi-select pill (amenities, highlights) laid out two to a row.
export function TogglePill({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.toggle, active && s.toggleOn]}
      accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={label}>
      <Text style={[s.toggleText, active && { color: "#fff" }]} numberOfLines={1}>{label}</Text>
      <Ionicons name={active ? "checkmark-circle" : "add-circle-outline"} size={16} color={active ? "#fff" : brand.inkSoft} />
    </Pressable>
  );
}

// Single-select pill (availability, photo room).
export function ChoicePill({ label, active, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={[s.pill, active && s.pillOn, style]}
      accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={label}>
      {active ? <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} /> : null}
      <Text style={[s.pillText, active && { color: "#fff" }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// Dashed drop zone used for the cover and room photos.
export function UploadBox({ title, hint, onPress, busy, error, height = 120 }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[s.upload, { height }, error && s.fieldErr]}
      accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ busy: !!busy }}>
      {busy ? <ActivityIndicator color={brand.violet} /> : <Ionicons name="camera-outline" size={28} color={brand.violet} />}
      <Text style={s.uploadTitle}>{busy ? "Uploading…" : title}</Text>
      {hint && !busy ? <Text style={s.uploadHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.ivory, paddingHorizontal: 18, paddingBottom: 12, overflow: "hidden" },
  headerArt: { position: "absolute", top: 0, right: 0, overflow: "hidden" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  hTitle: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: brand.ink, marginTop: 8, letterSpacing: -0.4 },
  hSub: { fontSize: 13.5, color: brand.inkSoft, marginTop: 2 },

  stepperWrap: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 4 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 34 },
  stepTrack: { position: "absolute", left: 15, right: 15, height: 2, borderRadius: 1, backgroundColor: LINE },
  stepTrackDone: { backgroundColor: brand.violet },
  stepSlot: { width: 30, height: 34, alignItems: "center", justifyContent: "center" },
  dotCur: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", shadowColor: brand.violet, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  dotCurText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  dotDone: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: brand.violet, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  dotTodo: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ivory, alignItems: "center", justifyContent: "center" },
  dotTodoText: { color: brand.inkSoft, fontSize: 12, fontWeight: "700" },
  stepMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 12 },
  stepCount: { fontSize: 11.5, color: brand.inkSoft, fontWeight: "600" },
  stepName: { flexShrink: 1, fontSize: 11.5, color: brand.violet, fontWeight: "700" },

  card: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#EEE7FB",
    shadowColor: brand.deep, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  labelIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 14, fontWeight: "700", color: brand.ink },
  err: { color: colors.error, fontSize: 12, fontWeight: "600", marginTop: 6 },

  select: { minHeight: 46, flexDirection: "row", alignItems: "center", borderWidth: 1.2, borderColor: LINE, borderRadius: 12, paddingHorizontal: 12, backgroundColor: FIELD_BG },
  selectText: { flex: 1, fontSize: 14, fontWeight: "600", color: brand.ink, marginRight: 6 },
  fieldErr: { borderColor: colors.error },
  fieldFocus: { borderColor: brand.violet },
  multiline: { alignItems: "flex-start", paddingVertical: 10 },
  smallLabel: { fontSize: 12.5, fontWeight: "700", color: brand.ink, marginBottom: 6 },
  input: { flex: 1, fontSize: 14, fontWeight: "600", color: brand.ink, paddingVertical: 10 },
  prefix: { marginLeft: -12, marginRight: 10, alignSelf: "stretch", width: 40, alignItems: "center", justifyContent: "center", borderRightWidth: 1.2, borderRightColor: LINE },
  prefixText: { fontSize: 15, fontWeight: "700", color: brand.violet },
  selectOpen: { borderColor: brand.violet },
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 20 },
  menu: {
    position: "absolute", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.2, borderColor: LINE, padding: 4, overflow: "hidden",
    shadowColor: brand.deep, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, height: OPTION_H, paddingHorizontal: 12, borderRadius: 10 },
  optionOn: { backgroundColor: brand.lavender },
  optionIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  optionIconOn: { backgroundColor: brand.violet },
  optionPressed: { backgroundColor: "#F7F3FF" },
  optionText: { flex: 1, fontSize: 14, fontWeight: "600", color: brand.ink },
  optionTextOn: { color: brand.violet, fontWeight: "700" },

  tile: { flex: 1, height: 96, borderRadius: 16, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#FCFAFF", alignItems: "center", justifyContent: "center", gap: 8 },
  tileOn: { borderColor: brand.violet, backgroundColor: brand.lavender },
  tileTick: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: brand.violet, alignItems: "center", justifyContent: "center" },
  tileText: { fontSize: 14.5, fontWeight: "700", color: brand.ink },

  toggle: { width: "48.5%", minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, borderWidth: 1.2, borderColor: LINE, borderRadius: radius.pill, paddingHorizontal: 14, backgroundColor: FIELD_BG },
  toggleOn: { backgroundColor: brand.violet, borderColor: brand.violet },
  toggleText: { flexShrink: 1, fontSize: 12.5, fontWeight: "600", color: brand.ink },

  pill: { minHeight: 42, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.2, borderColor: LINE, backgroundColor: FIELD_BG, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pillOn: { borderColor: brand.violet },
  pillText: { fontSize: 13, fontWeight: "600", color: brand.ink },

  upload: { borderWidth: 1.5, borderStyle: "dashed", borderColor: "#C9B5F5", borderRadius: 16, backgroundColor: "#FCFAFF", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12 },
  uploadTitle: { fontSize: 14, fontWeight: "700", color: brand.ink, marginTop: 4 },
  uploadHint: { fontSize: 12, color: brand.inkSoft, textAlign: "center" },
});
