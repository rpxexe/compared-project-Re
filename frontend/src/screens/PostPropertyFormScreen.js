import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Input from "../components/Input";
import Button from "../components/Button";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { formatInr } from "../utils/format";
import { getCurrentUserLocation } from "../services/locationService";
import {
  AMENITIES, BHKS, CATEGORY_OPTIONS, EMPTY_FORM, FACINGS, FURNISHING, LISTING_OPTIONS, MAX_IMAGES, RENT_AVAILABILITY, SALE_POSSESSION, STEPS,
  buildPayload, firstInvalidStep, isHttpUrl, needsBhk, priceLabel, sanitizeForType, showsBathrooms, showsFloor, showsFurnishing, typesFor, validateStep,
} from "../utils/postPropertyFlow";
import { colors, glow, radius, shadow } from "../theme";
import Text from "../components/AppText";

// Which step owns a backend field error, so server-side validation can send the user to the right place.
const FIELD_STEP = { title: 0, propertyType: 0, city: 1, locality: 1, bhk: 2, area: 2, bathrooms: 2, furnishing: 2, price: 3, images: 5, description: 6, contactPhone: 6 };

const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label || "";

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label}
      style={[s.chip, active && s.chipOn]} hitSlop={4}>
      {active ? <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} /> : null}
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}
const Label = ({ children }) => <Text style={s.label}>{children}</Text>;
const Err = ({ children }) => (children ? <Text style={s.err} accessibilityLiveRegion="polite">{children}</Text> : null);
const Gap = () => <View style={{ height: 16 }} />;

function Wizard({ navigation, listingType, category }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const scroll = useRef(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [imageDraft, setImageDraft] = useState("");
  const [imageError, setImageError] = useState("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [locatingProperty, setLocatingProperty] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const bar = useRef(new Animated.Value(1 / STEPS.length)).current;
  const ctx = { listingType, category };
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;
  const rent = listingType === "rent";

  const fetchPropertyLocation = async () => {
    setLocatingProperty(true);
    try {
      const res = await getCurrentUserLocation();
      if (res && res.city) {
        set("city", res.city);
        if (res.locality) set("locality", res.locality);
        toast.show("Location detected: " + [res.locality, res.city].filter(Boolean).join(", "));
      }
    } catch (err) {
      toast.show(err?.message || "Could not detect location");
    } finally {
      setLocatingProperty(false);
    }
  };

  const set = (key, value) => {
    setForm((f) => sanitizeForType({ ...f, [key]: value }, category));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setApiError("");
  };

  // Animate between steps and keep the scroll position at the top of each step.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    Animated.timing(bar, { toValue: (step + 1) / STEPS.length, duration: 300, useNativeDriver: false }).start();
    scroll.current?.scrollTo?.({ y: 0, animated: false });
    navigation.setOptions({ gestureEnabled: step === 0 && !done });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = useCallback(() => {
    if (step > 0) { setStep((n) => n - 1); setErrors({}); return true; }
    navigation.goBack();
    return true;
  }, [step, navigation]);

  useEffect(() => {
    if (done) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => (step > 0 ? goBack() : false));
    return () => sub.remove();
  }, [step, done, goBack]);

  const next = () => {
    const e = validateStep(cur.key, form, ctx);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.show("Please fix the highlighted fields", "error");
      return;
    }
    setStep((n) => Math.min(n + 1, STEPS.length - 1));
  };

  const addImage = () => {
    const url = imageDraft.trim();
    if (!url) return;
    if (!isHttpUrl(url)) return setImageError("Link must start with http:// or https://");
    if (form.images.includes(url)) return setImageError("You've already added that image");
    if (form.images.length >= MAX_IMAGES) return setImageError(`You can add up to ${MAX_IMAGES} images`);
    setImageError("");
    setImageDraft("");
    set("images", [...form.images, url]);
  };
  const toggleAmenity = (a) => set("amenities", form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);
  const addCustomAmenity = () => {
    const a = customAmenity.trim().slice(0, 40);
    if (!a) return;
    if (!form.amenities.some((x) => x.toLowerCase() === a.toLowerCase()) && form.amenities.length < 30) set("amenities", [...form.amenities, a]);
    setCustomAmenity("");
  };

  const submit = async () => {
    if (submitting) return;
    setApiError("");
    const bad = firstInvalidStep(form, ctx);
    if (bad) {
      setStep(bad.stepIndex);
      setErrors(bad.errors);
      toast.show("Please complete the highlighted fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.postProperty(buildPayload(form, ctx));
      const message = result?.message || "Your property has been submitted successfully.";
      setDone(message);
      toast.show(message, "success");
    } catch (error) {
      const fe = error?.fieldErrors;
      if (fe && typeof fe === "object") {
        const keys = Object.keys(fe).filter((k) => fe[k]);
        const target = keys.map((k) => FIELD_STEP[k]).filter((n) => n !== undefined);
        if (target.length) setStep(Math.min(...target));
        setErrors(fe);
      }
      const message = error?.message || "Could not submit your property. Please try again.";
      setApiError(message);
      toast.show(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const typeOptions = typesFor(category);
  const maxW = Math.min(width, 680);
  const summaryRows = [
    ["Purpose", labelOf(LISTING_OPTIONS, listingType), 0],
    ["Category", labelOf(CATEGORY_OPTIONS, category), 0],
    ["Property type", form.propertyType, 0],
    ["Title", form.title.trim(), 0],
    ["Location", [form.locality.trim(), form.city.trim()].filter(Boolean).join(", "), 1],
    ["Configuration", needsBhk(category, form.propertyType) && form.bhk ? `${form.bhk} BHK` : "", 2],
    ["Area", form.area ? `${form.area} sq.ft` : "", 2],
    ["Bathrooms", form.bathrooms, 2],
    ["Floor", form.floor.trim(), 2],
    ["Facing", form.facing, 2],
    ["Furnishing", form.furnishing, 2],
    ["Parking", form.parking.trim(), 2],
    [rent ? "Monthly rent" : "Price", form.price ? `${formatInr(Number(String(form.price).replace(/,/g, ""))) || `₹${form.price}`}${rent ? " / month" : ""}` : "", 3],
    [rent ? "Availability" : "Possession", form.availability, 3],
    ["Amenities", form.amenities.length ? `${form.amenities.length} selected` : "", 4],
    ["Photos", form.images.length ? `${form.images.length} added` : "", 5],
  ].filter((r) => r[1]);

  if (done) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={[s.doneWrap, { maxWidth: maxW }]}>
          <LinearGradient colors={[colors.neon, colors.violet]} style={[s.doneIcon, glow]}><Ionicons name="checkmark" size={40} color="#fff" /></LinearGradient>
          <Text style={s.doneTitle}>Property submitted!</Text>
          <Text style={s.doneText}>{done}</Text>
          <Button title="View my properties" icon="list" onPress={() => navigation.navigate("MyProperties")} style={{ marginTop: 22, alignSelf: "stretch" }} />
          <Button title="Post another property" variant="ghost" onPress={() => navigation.navigate("Tabs", { screen: "Post" })} style={{ marginTop: 10, alignSelf: "stretch" }} />
          <Button title="Back to Home" variant="ghost" onPress={() => navigation.navigate("Tabs", { screen: "Home" })} style={{ marginTop: 10, alignSelf: "stretch" }} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.deepViolet, colors.plum]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={[s.headerIn, { maxWidth: maxW }]}>
          <View style={s.headerRow}>
            <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={s.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.hTitle}>Post property</Text>
              <View style={s.pills}>
                <View style={s.pill}><Text style={s.pillText}>{labelOf(LISTING_OPTIONS, listingType)}</Text></View>
                <View style={s.pill}><Text style={s.pillText}>{labelOf(CATEGORY_OPTIONS, category)}</Text></View>
              </View>
            </View>
          </View>
          <View style={s.progressRow}>
            <Text style={s.stepCount} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>Step {step + 1} of {STEPS.length}</Text>
            <Text style={s.stepName} numberOfLines={1}>{cur.title}</Text>
          </View>
          <View style={s.track}>
            <Animated.View style={[s.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingHorizontal: 16, paddingBottom: 24 }}>
          <Animated.View style={[s.card, { maxWidth: maxW - 32, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
            <View style={s.cardHead}>
              <View style={s.cardIcon}><Ionicons name={cur.icon} size={21} color={colors.goldDeep} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{cur.title}</Text>
                <Text style={s.cardSub}>{cur.subtitle}</Text>
              </View>
            </View>
            {apiError ? <View style={s.apiErr}><Ionicons name="alert-circle-outline" size={19} color={colors.error} /><Text style={s.apiErrText}>{apiError}</Text></View> : null}

            {cur.key === "basics" ? (
              <>
                <Input label="PROPERTY TITLE *" value={form.title} onChangeText={(v) => set("title", v)} placeholder={category === "commercial" ? "e.g. Ground-floor shop near station" : "e.g. Spacious 2 BHK apartment"} maxLength={120} error={errors.title} />
                <Gap />
                <Label>PROPERTY TYPE *</Label>
                <View style={s.chipRow}>{typeOptions.map((t) => <Chip key={t} label={t} active={form.propertyType === t} onPress={() => set("propertyType", t)} />)}</View>
                <Err>{errors.propertyType}</Err>
              </>
            ) : null}

            {cur.key === "location" ? (
              <>
                <Pressable
                  onPress={fetchPropertyLocation}
                  disabled={locatingProperty}
                  style={s.autoLocateBtn}
                  accessibilityRole="button"
                >
                  {locatingProperty ? (
                    <ActivityIndicator size="small" color={colors.goldDeep} />
                  ) : (
                    <Ionicons name="navigate-outline" size={16} color={colors.goldDeep} />
                  )}
                  <Text style={s.autoLocateText}>
                    {locatingProperty ? "Detecting location..." : "Use Current Location"}
                  </Text>
                </Pressable>
                <Gap />
                <Input label="CITY *" value={form.city} onChangeText={(v) => set("city", v)} placeholder="e.g. Mumbai" autoCapitalize="words" error={errors.city} />
                <Gap />
                <Input label="LOCALITY / AREA *" value={form.locality} onChangeText={(v) => set("locality", v)} placeholder="e.g. Andheri West" autoCapitalize="words" error={errors.locality} />
              </>
            ) : null}

            {cur.key === "specs" ? (
              <>
                {needsBhk(category, form.propertyType) ? (
                  <>
                    <Label>BEDROOMS (BHK) *</Label>
                    <View style={s.chipRow}>{BHKS.map((b) => <Chip key={b} label={`${b} BHK`} active={form.bhk === b} onPress={() => set("bhk", b)} />)}</View>
                    <Err>{errors.bhk}</Err>
                    <Gap />
                  </>
                ) : null}
                <Input label="AREA (SQ. FT.) *" value={form.area} onChangeText={(v) => set("area", v.replace(/[^\d.]/g, ""))} placeholder="e.g. 950" keyboardType="decimal-pad" error={errors.area} />
                {showsBathrooms(form.propertyType) ? (
                  <>
                    <Gap />
                    <Input label={category === "commercial" ? "WASHROOMS" : "BATHROOMS"} value={form.bathrooms} onChangeText={(v) => set("bathrooms", v.replace(/\D/g, "").slice(0, 2))} placeholder="e.g. 2" keyboardType="number-pad" error={errors.bathrooms} />
                  </>
                ) : null}
                {showsFloor(form.propertyType) ? (
                  <>
                    <Gap />
                    <Input label="FLOOR" value={form.floor} onChangeText={(v) => set("floor", v)} placeholder="e.g. 5 of 12" maxLength={20} />
                  </>
                ) : null}
                {category === "residential" && form.propertyType ? (
                  <>
                    <Gap />
                    <Label>FACING</Label>
                    <View style={s.chipRow}>{FACINGS.map((x) => <Chip key={x} label={x} active={form.facing === x} onPress={() => set("facing", form.facing === x ? "" : x)} />)}</View>
                  </>
                ) : null}
                <Gap />
                <Input label="PARKING" value={form.parking} onChangeText={(v) => set("parking", v)} placeholder="e.g. 1 covered" maxLength={30} />
                {showsFurnishing(form.propertyType) ? (
                  <>
                    <Gap />
                    <Label>FURNISHING</Label>
                    <View style={s.chipRow}>{FURNISHING.map((x) => <Chip key={x} label={x} active={form.furnishing.toLowerCase() === x.toLowerCase()} onPress={() => set("furnishing", form.furnishing === x ? "" : x)} />)}</View>
                  </>
                ) : null}
              </>
            ) : null}

            {cur.key === "pricing" ? (
              <>
                <Input label={`${priceLabel(listingType).toUpperCase()} *`} value={form.price} onChangeText={(v) => set("price", v.replace(/[^\d.]/g, ""))} placeholder={rent ? "e.g. 35000" : "e.g. 12500000"} keyboardType="decimal-pad" prefix="₹" error={errors.price}
                  hint={Number(form.price) > 0 ? `${formatInr(Number(form.price))}${rent ? " per month" : ""}` : undefined} />
                <Gap />
                <Label>{rent ? "AVAILABLE FROM" : "POSSESSION STATUS"}</Label>
                <View style={s.chipRow}>{(rent ? RENT_AVAILABILITY : SALE_POSSESSION).map((x) => <Chip key={x} label={x} active={form.availability === x} onPress={() => set("availability", form.availability === x ? "" : x)} />)}</View>
              </>
            ) : null}

            {cur.key === "amenities" ? (
              <>
                <View style={s.chipRow}>
                  {[...AMENITIES[category], ...form.amenities.filter((a) => !AMENITIES[category].includes(a))].map((a) => <Chip key={a} label={a} active={form.amenities.includes(a)} onPress={() => toggleAmenity(a)} />)}
                </View>
                <Gap />
                <View style={s.addRow}>
                  <Input style={{ flex: 1 }} label="ADD ANOTHER" value={customAmenity} onChangeText={setCustomAmenity} placeholder="e.g. Terrace garden" maxLength={40} onSubmitEditing={addCustomAmenity} returnKeyType="done" />
                  <Pressable onPress={addCustomAmenity} accessibilityRole="button" accessibilityLabel="Add amenity" style={s.addBtn}><Ionicons name="add" size={24} color="#fff" /></Pressable>
                </View>
                <Text style={s.note}>Optional · {form.amenities.length} selected</Text>
              </>
            ) : null}

            {cur.key === "photos" ? (
              <>
                <View style={s.addRow}>
                  <Input style={{ flex: 1 }} label="IMAGE LINK" value={imageDraft} onChangeText={(v) => { setImageDraft(v); setImageError(""); }} placeholder="https://..." autoCapitalize="none" autoCorrect={false} keyboardType="url" onSubmitEditing={addImage} returnKeyType="done" error={imageError || errors.images} />
                  <Pressable onPress={addImage} accessibilityRole="button" accessibilityLabel="Add image" style={s.addBtn}><Ionicons name="add" size={24} color="#fff" /></Pressable>
                </View>
                <Text style={s.note}>Optional · {form.images.length}/{MAX_IMAGES} added. The first image becomes the cover photo.</Text>
                <View style={{ marginTop: 12, gap: 10 }}>
                  {form.images.map((u, i) => (
                    <View key={u} style={s.imgRow}>
                      <Image source={{ uri: u }} style={s.thumb} />
                      <View style={{ flex: 1 }}>
                        {i === 0 ? <Text style={s.cover}>COVER</Text> : null}
                        <Text style={s.imgUrl} numberOfLines={2}>{u}</Text>
                      </View>
                      <Pressable onPress={() => set("images", form.images.filter((x) => x !== u))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove image">
                        <Ionicons name="close-circle" size={24} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {cur.key === "review" ? (
              <>
                <Input label="PROPERTY DESCRIPTION *" value={form.description} onChangeText={(v) => set("description", v)} placeholder="Describe the property, nearby facilities, highlights..." multiline maxLength={2000} error={errors.description} />
                <Gap />
                <Input label="CONTACT NAME" value={form.contactName} onChangeText={(v) => set("contactName", v)} placeholder="Your name" autoCapitalize="words" maxLength={80} />
                <Gap />
                <Input label="CONTACT MOBILE" value={form.contactPhone} onChangeText={(v) => set("contactPhone", v.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" keyboardType="phone-pad" error={errors.contactPhone} hint="Leave blank to use your account number" />
                <View style={s.summary}>
                  <Text style={s.sumTitle}>Review your listing</Text>
                  {summaryRows.map(([k, v, to]) => (
                    <View key={k} style={s.sumRow}>
                      <Text style={s.sumKey}>{k}</Text>
                      <Text style={s.sumVal} numberOfLines={2}>{v}</Text>
                      <Pressable onPress={() => { setErrors({}); setStep(to); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${k}`}><Text style={s.edit}>Edit</Text></Pressable>
                    </View>
                  ))}
                </View>
                <View style={s.note2}><Ionicons name="shield-checkmark-outline" size={17} color={colors.success} /><Text style={s.note2Text}>Your listing may be reviewed before it goes live.</Text></View>
              </>
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={[s.footerIn, { maxWidth: maxW - 32 }]}>
            <Button title="Back" variant="ghost" icon="arrow-back" onPress={goBack} style={{ flex: 1 }} disabled={submitting} />
            {last
              ? <Button title="Submit" icon="paper-plane" loading={submitting} onPress={submit} style={{ flex: 1.4 }} />
              : <Button title="Continue" icon="arrow-forward" onPress={next} style={{ flex: 1.4 }} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// The two selections are required route params. If someone lands here without them
// (deep link, stale state) send them back to the selection step instead of showing a broken form.
export default function PostPropertyFormScreen({ navigation, route }) {
  const listingType = route?.params?.listingType;
  const category = route?.params?.category;
  const valid = ["rent", "sale"].includes(listingType) && ["residential", "commercial"].includes(category);
  useEffect(() => {
    if (!valid) navigation.navigate("Tabs", { screen: "Post" });
  }, [valid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!valid) return null;
  return <Wizard navigation={navigation} listingType={listingType} category={category} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  header: { paddingBottom: 14, alignItems: "center" },
  headerIn: { width: "100%", paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  hTitle: { color: "#fff", fontSize: 19, fontWeight: "800" },
  pills: { flexDirection: "row", gap: 6, marginTop: 5 },
  pill: { backgroundColor: "rgba(199,125,255,0.22)", borderColor: "rgba(199,125,255,0.5)", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: "#EADCFF", fontSize: 11.5, fontWeight: "700" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 8 },
  stepCount: { color: colors.neon, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.4 },
  stepName: { color: "#D2C5EE", fontSize: 12.5, fontWeight: "600", flexShrink: 1, marginLeft: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.neon },
  card: { width: "100%", marginTop: 16, backgroundColor: colors.white, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: "#E6DEF7", ...shadow.card },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.champagneSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  cardSub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 8 },
  err: { color: colors.error, fontSize: 12, fontWeight: "600", marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.line, borderRadius: 24, paddingHorizontal: 14, backgroundColor: "#FBF9FF" },
  chipOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
  addRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  addBtn: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.violet, alignItems: "center", justifyContent: "center", marginBottom: 0 },
  note: { color: colors.muted, fontSize: 12, marginTop: 10 },
  imgRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FBF9FF" },
  thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: colors.lavender },
  cover: { color: colors.violet, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  imgUrl: { color: colors.text, fontSize: 12 },
  summary: { marginTop: 22, borderRadius: radius.md, backgroundColor: "#F6F2FF", padding: 14, borderWidth: 1, borderColor: colors.line },
  sumTitle: { fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 6 },
  sumRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: 8 },
  sumKey: { width: 104, color: colors.muted, fontSize: 12.5, fontWeight: "600" },
  sumVal: { flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: "700" },
  edit: { color: colors.violet, fontSize: 12.5, fontWeight: "800", paddingVertical: 4 },
  note2: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  note2Text: { flex: 1, color: colors.muted, fontSize: 12 },
  apiErr: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#FFF0F0", borderRadius: 12, padding: 12, marginBottom: 14 },
  apiErrText: { flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 },
  footer: { backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 10, alignItems: "center", ...shadow.card },
  footerIn: { width: "100%", flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  doneWrap: { flex: 1, width: "100%", alignSelf: "center", alignItems: "center", justifyContent: "center", padding: 24 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 18 },
  doneText: { color: colors.muted, textAlign: "center", lineHeight: 22, fontSize: 14, marginTop: 8 },
  autoLocateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.champagneSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    alignSelf: "flex-start",
  },
  autoLocateText: {
    color: colors.goldDeep,
    fontSize: 13,
    fontWeight: "700",
  },
});
