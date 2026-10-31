import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, Image, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Button from "../components/Button";
import {
  Appear, Card, ChoicePill, ChoiceTile, DropdownHost, ErrorText, FieldLabel, KeepVisibleContext, LINE, SelectField, Stepper, SuggestionList, TextField, UploadBox, WizardHeader,
} from "../components/postProperty/Parts";
import Submitted from "../components/postProperty/Submitted";
import { useAuth } from "../context/AuthContext";
import { useLocationAccess } from "../context/LocationAccessContext";
import { useBottomSpace } from "../hooks/useBottomSpace";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { formatInr } from "../utils/format";
import PressableScale from "../components/PressableScale";
import { isReducedMotion } from "../hooks/useReducedMotion";
import { POPULAR_CITIES, getCurrentUserLocation } from "../services/locationService";
import {
  AREA_UNITS, BATHROOMS, BHKS, FLOORS, GROUND, CATEGORY_OPTIONS, CUSTOM_DATE, EMPTY_FORM, FACINGS, FURNISHING, FURNISHING_ICONS, LISTING_OPTIONS, MAX_PHOTOS, PARKING,
  PARKING_ICONS, TYPE_ICONS,
  PROPERTY_AGES, RENT_AVAILABILITY, SALE_POSSESSION, STEPS, MAX_AMENITIES, availabilityText, buildPayload, firstInvalidStep,
  floorText, maskDate, needsBhk, photoRoomsFor, priceLabel, sanitizeForType, sectionsFor, showsAge, showsBuildingFields, showsFloor, typeLabel, typesFor, validateStep,
} from "../utils/postPropertyFlow";
import { LinearGradient } from "expo-linear-gradient";
import { brand, colors, gradients } from "../theme";
import Text from "../components/AppText";

// TESTING: a step key ("purpose", "amenities", "details", "review") opens the form on that step
// alone, with a bar to switch the property being previewed. Set back to null before shipping.
const ONLY_STEP = null;
const STEP_LIST = ONLY_STEP ? STEPS.filter((x) => x.key === ONLY_STEP) : STEPS;
const TEST_FORM = { listingType: "sale", category: "residential", propertyType: "Flats/Apartments", furnishing: "Furnished" };

// Toast titles for the AI writer's errors (codes from the server, plus no-network / timeout).
const AI_ERROR_TITLES = {
  AI_BUSY: "AI is busy right now",
  AI_DAILY_LIMIT: "Daily AI limit reached",
  AI_NOT_CONFIGURED: "AI writer unavailable",
  AI_NEEDS_DETAILS: "A few details needed",
  AI_FAILED: "Couldn't write a description",
};
function aiErrorToast(e) {
  if (e?.network) {
    return /too long/i.test(e.message)
      ? { title: "AI took too long", message: "Writing took longer than expected. Please try again." }
      : { title: "No connection", message: "Couldn't reach the server. Check your internet connection and try again." };
  }
  if (e?.status === 429 && !e.code) return { title: "Slow down a little", message: e.message };
  return { title: AI_ERROR_TITLES[e?.code] || "Couldn't write a description", message: e?.message || "Please try again, or write it yourself." };
}

// Which step owns a backend field error, so server-side validation can send the user to the right place.
const FIELD_STEP = {
  listingType: 0, category: 0, title: 0, propertyType: 0, city: 0, locality: 0,
  bhk: 0, area: 0, bathrooms: 0, floor: 0, totalFloors: 0, furnishing: 0,
  price: 0, possessionStatus: 0, ageOfProperty: 0, images: 2, description: 2,
};

const FIELD_GAP = 24;
const ROOM_ICONS = {
  Hall: "tv-outline", Bedroom: "bed-outline", Kitchen: "restaurant-outline", Bathroom: "water-outline", Balcony: "sunny-outline",
  "Front View": "storefront-outline", Interior: "business-outline", Washroom: "water-outline", Parking: "car-outline",
  Site: "map-outline", Surroundings: "leaf-outline", Other: "images-outline",
};
const MAX_SUGGESTIONS = 5;
const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
// Names starting with what was typed come first, then names containing it; an exact match is
// already chosen, so it is left out.
function rankSuggestions(items, typed) {
  const q = typed.trim().toLowerCase();
  if (!q) return items.slice(0, MAX_SUGGESTIONS);
  const starts = [];
  const has = [];
  items.forEach((it) => {
    const v = it.title.toLowerCase();
    if (v === q) return;
    if (v.startsWith(q)) starts.push(it);
    else if (v.includes(q)) has.push(it);
  });
  return [...starts, ...has].slice(0, MAX_SUGGESTIONS);
}
const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label || "";
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
let photoSeq = 0;

// Label on the left, control on the right - the layout of the Specifications step.
function SpecRow({ icon, label, required, error, children }) {
  return (
    <View style={s.specRow}>
      <View style={s.specLabel}>
        <View style={s.specIcon}><Ionicons name={icon} size={16} color={brand.violet} /></View>
        <Text style={s.specText}>{label}{required ? <Text style={{ color: colors.error }}> *</Text> : null}</Text>
      </View>
      <View style={s.specControl}>
        {children}
        <ErrorText>{error}</ErrorText>
      </View>
    </View>
  );
}

// Tick-box tile of the Amenities step; `radio` draws a round mark for single-choice sections.
function CheckTile({ label, active, radio, onPress }) {
  return (
    <PressableScale to={0.96} onPress={onPress} style={[s.tile, active && s.tileOn]}
      accessibilityRole={radio ? "radio" : "checkbox"} accessibilityState={{ checked: active }} accessibilityLabel={label}>
      <View style={[s.tick, radio && s.tickRadio, active && s.tickOn]}>
        {active ? <Appear scale><Ionicons name="checkmark" size={13} color="#fff" /></Appear> : null}
      </View>
      <Text style={[s.tileText, active && s.tileTextOn]} numberOfLines={2}>{label}</Text>
    </PressableScale>
  );
}

function Wizard({ navigation, initial }) {
  const { bottom } = useBottomSpace();
  const toast = useToast();
  const { token, openLoginPrompt } = useAuth();
  const { ensureLocation } = useLocationAccess();
  const scroll = useRef(null);
  const content = useRef(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => sanitizeForType({ ...EMPTY_FORM, ...(ONLY_STEP ? TEST_FORM : {}), ...initial }));
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [uploading, setUploading] = useState({ cover: false, photos: false });
  const [room, setRoom] = useState("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [sectionKey, setSectionKey] = useState(""); // Amenities tab on show; the first one by default
  const [locating, setLocating] = useState(false);
  const [writing, setWriting] = useState(false); // AI description request in flight
  const [beforeAi, setBeforeAi] = useState(null); // description the AI replaced, for Undo
  // City / locality suggestions: popular cities plus every city already listed, and localities
  // from existing listings looked up as the user types.
  const [locFocus, setLocFocus] = useState(null); // "city" | "locality" | null
  const [cities, setCities] = useState(POPULAR_CITIES);
  const [places, setPlaces] = useState([]); // [{ locality, city }]
  const fade = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  // Which way the step content slides in: worked out while rendering the new step, so the very
  // first frame of the transition already knows (1 moving forward, -1 going back).
  const shownStep = useRef(0);
  const dir = useRef(1);
  if (step !== shownStep.current) {
    dir.current = step > shownStep.current ? 1 : -1;
    shownStep.current = step;
    if (!isReducedMotion()) fade.setValue(0); // hidden from its first frame, then faded in below
  }
  const cur = STEP_LIST[step];
  const last = step === STEP_LIST.length - 1;
  const rent = form.listingType === "rent";
  const building = showsBuildingFields(form.propertyType);
  const rooms = photoRoomsFor(form.category, form.propertyType);
  const activeRoom = rooms.includes(room) ? room : rooms[0];
  const busy = uploading.cover || uploading.photos;

  useEffect(() => {
    api.facets().then((r) => {
      const seen = new Set();
      setCities([...POPULAR_CITIES, ...(r?.cities || [])].map((c) => String(c || "").trim()).filter((c) => {
        const k = c.toLowerCase();
        if (!c || seen.has(k)) return false;
        seen.add(k);
        return true;
      }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (locFocus !== "locality") return undefined;
    const search = form.locality.trim() || form.city.trim();
    const t = setTimeout(() => {
      api.locations({ search, limit: 50 }).then((r) => setPlaces(r?.locations || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [locFocus, form.locality, form.city]);

  const update = (fn) => setForm((f) => sanitizeForType(fn(f)));
  const set = (key, value) => {
    update((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setApiError("");
  };

  // Animate between steps and keep the scroll position at the top of each step.
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    scroll.current?.scrollTo?.({ y: 0, animated: false });
    navigation.setOptions({ gestureEnabled: step === 0 && !done });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Post tab keeps this screen mounted, so once the user moves on from the success screen
  // the next visit starts a fresh listing.
  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(() => navigation.addListener("blur", () => {
    if (!doneRef.current) return;
    setDone(null);
    setForm(sanitizeForType({ ...EMPTY_FORM, ...initial }));
    setErrors({});
    setRoom("");
    setStep(0);
  }), [navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Tabs", { screen: "Home" });
  }, [navigation]);

  const goBack = useCallback(() => {
    Keyboard.dismiss();
    if (step > 0) { setStep((n) => n - 1); setErrors({}); return true; }
    leave();
    return true;
  }, [step, leave]);

  useEffect(() => {
    if (done) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => (step > 0 ? goBack() : false));
    return () => sub.remove();
  }, [step, done, goBack]);

  const askLogin = () => openLoginPrompt({
    reason: "post_property",
    title: "Sign In to List Property",
    message: "Please sign in or register to complete your property listing.",
  });

  const jump = (i) => { Keyboard.dismiss(); setErrors({}); setStep(i); };

  // Once the keyboard has opened (and the scroll area has shrunk), make sure the whole focused
  // field, border included, sits at least FIELD_GAP above the keyboard. The scroll area runs
  // behind the floating tab bar, so with the keyboard closed the bar's height is not visible.
  const keepVisible = useCallback((node) => {
    setTimeout(() => {
      if (!node || !content.current) return;
      node.measureLayout(content.current, (x, y, w, h) => {
        const visible = viewportH.current - (Keyboard.isVisible() ? 0 : bottom);
        const needed = y + h + FIELD_GAP - visible;
        if (needed > scrollY.current) scroll.current?.scrollTo({ y: needed, animated: true });
      }, () => {});
    }, 350);
  }, [bottom]);

  const next = () => {
    Keyboard.dismiss();
    const e = validateStep(cur.key, form);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.show("Please fix the highlighted fields", "error");
      if (!isReducedMotion()) {
        Animated.sequence([10, -10, 7, -7, 3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
      }
      return;
    }
    // Photos upload to the account, so sign-in is asked for before the details steps.
    if (step === 0 && !token) return askLogin();
    setStep((n) => Math.min(n + 1, STEP_LIST.length - 1));
  };

  const locate = async () => {
    Keyboard.dismiss();
    if (!(await ensureLocation("Allow location to fill in the property's city and locality from where you are now."))) return;
    setLocating(true);
    try {
      const res = await getCurrentUserLocation();
      if (res?.city) set("city", res.city);
      if (res?.locality) set("locality", res.locality);
      if (!res?.city || !res?.locality) toast.show("Couldn't find the full address here. Please fill in the rest.");
    } catch (err) {
      toast.show(err?.message || "Could not detect location", "error");
    } finally {
      setLocating(false);
    }
  };

  const pick = async (limit) => {
    Keyboard.dismiss();
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
    });
    return res.canceled ? [] : (res.assets || []).slice(0, limit);
  };

  const uploadCover = async () => {
    if (!token) return askLogin(); // photos are saved to the account
    const [asset] = await pick(1);
    if (!asset) return;
    setUploading((u) => ({ ...u, cover: true }));
    try {
      const { url } = await api.uploadImage(asset);
      set("cover", { uri: asset.uri, url });
    } catch (e) {
      if (!e?.signInRequired) toast.show(e?.message || "Could not upload the image", "error");
    } finally {
      setUploading((u) => ({ ...u, cover: false }));
    }
  };

  const uploadPhotos = async () => {
    if (!token) return askLogin();
    const left = MAX_PHOTOS - form.photos.length;
    if (left <= 0) return;
    const assets = await pick(left);
    if (!assets.length) return;
    setUploading((u) => ({ ...u, photos: true }));
    let failed = 0;
    for (const asset of assets) {
      try {
        const { url } = await api.uploadImage(asset);
        photoSeq += 1;
        const photo = { id: `p${photoSeq}`, uri: asset.uri, url, room: activeRoom };
        update((f) => (f.photos.length < MAX_PHOTOS ? { ...f, photos: [...f.photos, photo] } : f));
      } catch (e) {
        if (e?.signInRequired) break; // the sign-in dialog is open; don't count the rest as failed
        failed += 1;
      }
    }
    setUploading((u) => ({ ...u, photos: false }));
    if (failed) toast.show(`${failed} photo${failed > 1 ? "s" : ""} could not be uploaded`, "error");
  };

  const addCustomAmenity = () => {
    const a = customAmenity.trim().slice(0, 40);
    if (!a) return;
    if (!form.amenities.some((x) => x.toLowerCase() === a.toLowerCase()) && form.amenities.length < MAX_AMENITIES) set("amenities", [...form.amenities, a]);
    setCustomAmenity("");
  };

  // Asks the server (Gemini) to write the description from everything filled in so far. An
  // existing description is sent as a draft to improve, after the user agrees to replace it.
  const writeWithAi = (confirmed = false) => {
    if (writing) return;
    Keyboard.dismiss();
    const draft = form.description.trim();
    if (draft.length >= 10 && !confirmed) {
      Alert.alert("Rewrite your description?", "The AI will use your text as a starting point and replace it. You can undo this.", [
        { text: "Cancel", style: "cancel" },
        { text: "Rewrite", onPress: () => writeWithAi(true) },
      ]);
      return;
    }
    if (!token) return askLogin();
    const priceNum = Number(form.price);
    setWriting(true);
    api.describeProperty({
      listingType: form.listingType,
      category: labelOf(CATEGORY_OPTIONS, form.category),
      propertyType: typeLabel(form.propertyType),
      bhk: needsBhk(form.category, form.propertyType) ? form.bhk : "",
      area: form.area ? `${form.area} ${labelOf(AREA_UNITS, form.areaUnit)}` : "",
      city: form.city.trim(),
      locality: form.locality.trim(),
      price: priceNum > 0 ? `${formatInr(priceNum)}${form.listingType === "rent" ? " per month" : ""}` : "",
      possession: availabilityText(form),
      age: form.age,
      floor: showsFloor(form.propertyType) ? floorText(form) : "",
      totalFloors: building ? form.totalFloors : "",
      bathrooms: building ? form.bathrooms : "",
      furnishing: building ? form.furnishing : "",
      facing: form.facing,
      parking: form.parking,
      grade: form.grade,
      amenities: form.amenities,
      facilities: form.facilities,
      draft,
    }).then((res) => {
      if (!res?.description) throw new Error("The AI couldn't write a description. Please try again.");
      setBeforeAi(form.description);
      set("description", res.description);
      toast.show("Description written. Read it through and edit anything that's off.");
    }).catch((e) => {
      if (e?.signInRequired) return; // the sign-in dialog is already open
      const { title, message } = aiErrorToast(e);
      toast.show(message, "error", { title });
    }).finally(() => setWriting(false));
  };

  const submit = async () => {
    if (submitting || busy) return;
    Keyboard.dismiss();
    if (!token) return askLogin();
    setApiError("");
    const bad = firstInvalidStep(form);
    if (bad) {
      setStep(bad.stepIndex);
      setErrors(bad.errors);
      toast.show("Please complete the highlighted fields", "error");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.postProperty(buildPayload(form));
      setDone(result?.message || "Submitted for review. It will appear once approved.");
    } catch (error) {
      if (error?.signInRequired) return; // the sign-in dialog is already open
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

  if (done) {
    return (
      <Submitted message={done}>
        <Button title="View my properties" icon="list" onPress={() => navigation.navigate("MyProperties")} />
        <Button title="Post another property" variant="ghost" onPress={() => navigation.replace("PostPropertyForm")} />
        <Button title="Back to Home" variant="ghost" onPress={() => navigation.navigate("Tabs", { screen: "Home" })} />
      </Submitted>
    );
  }

  const citySuggestions = locFocus === "city" ? rankSuggestions(cities.map((c) => ({ title: c })), form.city) : [];
  const localitySuggestions = locFocus === "locality" ? rankSuggestions(
    places
      .filter((p) => p.locality && (!form.city.trim() || sameText(p.city || "", form.city)))
      .filter((p, i, all) => all.findIndex((x) => sameText(x.locality, p.locality) && sameText(x.city || "", p.city || "")) === i)
      .map((p) => ({ title: p.locality, subtitle: p.city })),
    form.locality,
  ) : [];
  // The top suggestion when it carries on from what was typed, offered inline in the field.
  const startsWithTyped = (list, typed) => (list[0] && typed.trim() && list[0].title.toLowerCase().startsWith(typed.toLowerCase()) ? list[0] : null);
  const cityCompletion = startsWithTyped(citySuggestions, form.city);
  const localityCompletion = startsWithTyped(localitySuggestions, form.locality);
  const pickPlace = (it, field = locFocus) => {
    if (field === "city") set("city", it.title);
    else {
      set("locality", it.title);
      if (!form.city.trim() && it.subtitle) set("city", it.subtitle);
    }
    setLocFocus(null);
    Keyboard.dismiss();
  };

  const priceNum = Number(form.price);
  const roomPhotos = form.photos.filter((p) => p.room === activeRoom);
  const sections = sectionsFor(form);
  const picked = form.amenities.length + form.facilities.length + (form.grade ? 1 : 0);
  const sectionIdx = Math.max(0, sections.findIndex((x) => x.key === sectionKey));
  const section = sections[sectionIdx];
  const nextSection = sections[sectionIdx + 1];
  const chosenIn = (sec) => (sec.field === "grade" ? [form.grade] : form[sec.field]);
  const countIn = (sec) => sec.items.filter((i) => chosenIn(sec).includes(i)).length;
  const allPicked = [...form.amenities.map((a) => ["amenities", a]), ...form.facilities.map((a) => ["facilities", a]), ...(form.grade ? [["grade", form.grade]] : [])];
  const showSection = (key) => { Keyboard.dismiss(); setSectionKey(key); };
  const setAll = (sec, on) => set(sec.field, on
    ? [...form[sec.field], ...sec.items.filter((i) => !form[sec.field].includes(i))]
    : form[sec.field].filter((i) => !sec.items.includes(i)));
  const pickIn = (field, a) => (field === "grade" ? set("grade", form.grade === a ? "" : a) : set(field, toggle(form[field], a)));
  const summary = [
    ["swap-horizontal-outline", "Purpose", labelOf(LISTING_OPTIONS, form.listingType), 0],
    ["grid-outline", "Category", labelOf(CATEGORY_OPTIONS, form.category), 0],
    ["business-outline", "Type", typeLabel(form.propertyType), 0],
    ["location-outline", "Location", [form.locality.trim(), form.city.trim()].filter(Boolean).join(", "), 0],
    ["bed-outline", "Bedrooms", needsBhk(form.category, form.propertyType) && form.bhk ? `${form.bhk} BHK` : "", 0],
    ["water-outline", "Bathrooms", building ? form.bathrooms : "", 0],
    ["resize-outline", "Area", form.area ? `${form.area} ${labelOf(AREA_UNITS, form.areaUnit)}` : "", 0],
    ["layers-outline", "Total floors", building ? form.totalFloors : "", 0],
    ["business-outline", "Floor", showsFloor(form.propertyType) ? floorText(form) : "", 0],
    ["compass-outline", "Facing", form.facing, 0],
    ["car-outline", "Parking", form.parking, 0],
    ["bed-outline", "Furnishing", building ? form.furnishing : "", 0],
    ["pricetag-outline", priceLabel(form.listingType), priceNum > 0 ? `${formatInr(priceNum)}${rent ? " / month" : ""}` : "", 0],
    ["calendar-outline", rent ? "Available from" : "Possession", availabilityText(form), 0],
    ["time-outline", "Property age", showsAge(form) ? form.age : "", 0],
    ["sparkles-outline", "Amenities", picked ? `${picked} selected` : "", 1],
    ["ribbon-outline", "Building grade", form.grade, 1],
    ["images-outline", "Photos", `${(form.cover ? 1 : 0) + form.photos.length} added`, 2],
  ].filter((r) => r[2]);

  return (
    <DropdownHost style={s.root}>
      <StatusBar style="dark" />
      <WizardHeader title={cur.heading || "Post your property"} subtitle={cur.subtitle} onBack={goBack} />
      {ONLY_STEP ? null : <Stepper steps={STEPS} step={step} onJump={jump} />}

      {/* The form scrolls on behind the see-through tab bar; the bottom padding lets its end clear the bar. */}
      {/* "padding" on Android too: the app draws edge-to-edge, so the window no longer shrinks for the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <KeepVisibleContext.Provider value={keepVisible}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + 8 }}
          scrollEventThrottle={32} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; }}>
          <View ref={content} collapsable={false} style={s.scroll}>
          <Animated.View style={{ opacity: fade, transform: [{ translateX: Animated.add(shake, fade.interpolate({ inputRange: [0, 1], outputRange: [28 * dir.current, 0] })) }] }}>
            {ONLY_STEP ? (
              <Card style={s.testBar}>
                <Text style={s.testTitle}>Testing · preview for</Text>
                <View style={s.row}>
                  <SelectField style={{ flex: 1 }} title="Category" value={form.category} options={CATEGORY_OPTIONS} icon={false} onChange={(v) => set("category", v)} />
                  <SelectField style={{ flex: 1.3 }} title="Type" placeholder="Type" value={form.propertyType} icon={false}
                    options={typesFor(form.category).map((x) => ({ label: typeLabel(x), value: x, icon: TYPE_ICONS[x] }))} onChange={(v) => set("propertyType", v)} />
                </View>
                {ONLY_STEP === "amenities" ? (
                  <SelectField style={{ marginTop: 8 }} title="Furnishing" placeholder="Furnishing" value={form.furnishing} options={FURNISHING}
                    optionIcon={(v) => FURNISHING_ICONS[v]} onChange={(v) => set("furnishing", v)} />
                ) : null}
              </Card>
            ) : null}
            {apiError ? <View style={s.apiErr}><Ionicons name="alert-circle-outline" size={19} color={colors.error} /><Text style={s.apiErrText}>{apiError}</Text></View> : null}

            {cur.key === "purpose" ? (
              <Card index={0}>
                <FieldLabel icon="swap-horizontal-outline">I want to</FieldLabel>
                <View style={s.row} accessibilityRole="radiogroup">
                  {LISTING_OPTIONS.map((o) => (
                    <ChoiceTile key={o.value} label={o.label} icon={o.icon} active={form.listingType === o.value} onPress={() => set("listingType", o.value)} />
                  ))}
                </View>
                <ErrorText>{errors.listingType}</ErrorText>

                <FieldLabel icon="grid-outline" style={s.gap}>Property category</FieldLabel>
                <SelectField title="Property category" placeholder="Select category" value={form.category} options={CATEGORY_OPTIONS}
                  onChange={(v) => set("category", v)} error={errors.category} />
                <ErrorText>{errors.category}</ErrorText>

                <FieldLabel icon="business-outline" style={s.gap}>Property type</FieldLabel>
                <SelectField title="Property type" placeholder={form.category ? "Select type" : "Choose a category first"} value={form.propertyType}
                  options={typesFor(form.category).map((t) => ({ label: typeLabel(t), value: t, icon: TYPE_ICONS[t] }))} onChange={(v) => set("propertyType", v)} error={errors.propertyType} />
                <ErrorText>{errors.propertyType}</ErrorText>

                <FieldLabel icon="location-outline" style={s.gap} right={
                  <Pressable onPress={locate} disabled={locating} style={s.locate} accessibilityRole="button" accessibilityLabel="Use current location">
                    {locating ? <ActivityIndicator size="small" color={brand.violet} /> : <Ionicons name="navigate-outline" size={13} color={brand.violet} />}
                    <Text style={s.locateText}>{locating ? "Locating…" : "Use current location"}</Text>
                  </Pressable>
                }>Location</FieldLabel>
                <View style={s.row}>
                  <TextField style={{ flex: 1 }} label="City" required value={form.city} onChangeText={(v) => set("city", v)} placeholder="e.g. Mumbai" autoCapitalize="words" maxLength={60} error={errors.city}
                    onFocus={() => setLocFocus("city")} onBlur={() => setLocFocus((f) => (f === "city" ? null : f))} autoComplete="off" autoCorrect={false}
                    completion={cityCompletion?.title} onComplete={() => pickPlace(cityCompletion, "city")} returnKeyType="next" />
                  <TextField style={{ flex: 1 }} label="Locality / Area" required value={form.locality} onChangeText={(v) => set("locality", v)} placeholder="e.g. Andheri West" autoCapitalize="words" maxLength={80} error={errors.locality}
                    onFocus={() => setLocFocus("locality")} onBlur={() => setLocFocus((f) => (f === "locality" ? null : f))} autoComplete="off" autoCorrect={false}
                    completion={localityCompletion?.title} onComplete={() => pickPlace(localityCompletion, "locality")} returnKeyType="done" />
                </View>
                {citySuggestions.length ? (
                  <SuggestionList key="city" items={citySuggestions} query={form.city} icon="business-outline" onPick={pickPlace} />
                ) : localitySuggestions.length ? (
                  <SuggestionList key="locality" items={localitySuggestions} query={form.locality} onPick={pickPlace} />
                ) : null}
              </Card>
            ) : null}

            {cur.key === "purpose" ? (
              <Card index={1} style={s.cardGap}>
                <FieldLabel icon="options-outline">Specifications</FieldLabel>
                {needsBhk(form.category, form.propertyType) ? (
                  <SpecRow icon="bed-outline" label="Bedrooms" required error={errors.bhk}>
                    <SelectField title="Bedrooms" value={form.bhk} options={BHKS} optionIcon="bed-outline" format={(b) => `${b} BHK`} onChange={(v) => set("bhk", v)} error={errors.bhk} />
                  </SpecRow>
                ) : null}
                <SpecRow icon="resize-outline" label="Area" required error={errors.area}>
                  <View style={s.areaRow}>
                    <TextField style={{ flex: 1 }} value={form.area} onChangeText={(v) => set("area", v.replace(/[^\d.]/g, "").slice(0, 9))} placeholder="950" keyboardType="decimal-pad" accessibilityLabel="Area" />
                    <SelectField style={s.unit} title="Area unit" value={form.areaUnit} options={AREA_UNITS} optionIcon="resize-outline" icon={false} onChange={(v) => set("areaUnit", v)} />
                  </View>
                </SpecRow>
                {building ? (
                  <>
                    <SpecRow icon="water-outline" label={form.category === "commercial" ? "Washrooms" : "Bathrooms"}>
                      <SelectField title={form.category === "commercial" ? "Washrooms" : "Bathrooms"} value={form.bathrooms} options={BATHROOMS} optionIcon="water-outline" onChange={(v) => set("bathrooms", v)} />
                    </SpecRow>
                    <SpecRow icon="layers-outline" label="Total floors" error={errors.totalFloors}>
                      <TextField value={form.totalFloors} onChangeText={(v) => set("totalFloors", v.replace(/\D/g, "").slice(0, 3))} placeholder="e.g. 10" keyboardType="number-pad" accessibilityLabel="Total floors" />
                    </SpecRow>
                    {showsFloor(form.propertyType) ? (
                      <Appear><SpecRow icon="business-outline" label="Floor no." error={errors.floor}>
                        <SelectField title="Floor" value={form.floor} optionIcon="business-outline" error={errors.floor} onChange={(v) => set("floor", v)}
                          options={FLOORS.filter((x) => x === GROUND || !form.totalFloors || Number(x) <= Number(form.totalFloors))}
                          format={(x) => (x === GROUND ? "Ground floor" : `Floor ${x}`)} />
                      </SpecRow></Appear>
                    ) : null}
                  </>
                ) : null}
                {form.category === "residential" ? (
                  <SpecRow icon="compass-outline" label="Facing">
                    <SelectField title="Facing" value={form.facing} options={FACINGS} optionIcon="compass-outline" onChange={(v) => set("facing", v)} />
                  </SpecRow>
                ) : null}
                <SpecRow icon="car-outline" label="Parking">
                  <SelectField title="Parking" value={form.parking} options={PARKING} optionIcon={(v) => PARKING_ICONS[v]} onChange={(v) => set("parking", v)} />
                </SpecRow>
                {building ? (
                  <SpecRow icon="bed-outline" label="Furnishing">
                    <SelectField title="Furnishing" value={form.furnishing} options={FURNISHING} optionIcon={(v) => FURNISHING_ICONS[v]} onChange={(v) => set("furnishing", v)} />
                  </SpecRow>
                ) : null}
              </Card>
            ) : null}

            {cur.key === "purpose" ? (
              <Card index={2} style={s.cardGap}>
                <FieldLabel icon="pricetag-outline" required>{priceLabel(form.listingType)}</FieldLabel>
                <TextField prefix="₹" value={form.price ? Number(form.price).toLocaleString("en-IN") : ""} onChangeText={(v) => set("price", v.replace(/\D/g, "").slice(0, 12))}
                  placeholder={rent ? "25,000" : "2,50,00,000"} keyboardType="number-pad" accessibilityLabel={priceLabel(form.listingType)} error={errors.price} />
                {priceNum > 0 && !errors.price ? <Appear from={-4}><Text style={s.priceHint}>{formatInr(priceNum)}{rent ? " per month" : ""}</Text></Appear> : null}

                <FieldLabel icon="calendar-outline" style={s.gapLg}>{rent ? "Available from" : "Possession status"}</FieldLabel>
                <View style={s.pillGrid} accessibilityRole="radiogroup">
                  {(rent ? RENT_AVAILABILITY : SALE_POSSESSION).map((x) => (
                    <ChoicePill key={x} label={x} active={form.availability === x} style={s.half} onPress={() => set("availability", form.availability === x ? "" : x)} />
                  ))}
                </View>
                {rent && form.availability === CUSTOM_DATE ? (
                  <Appear>
                    <TextField style={{ marginTop: 12 }} label="Available from" required value={form.availableDate} onChangeText={(v) => set("availableDate", maskDate(v))}
                      placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} error={errors.availableDate} />
                  </Appear>
                ) : null}
              </Card>
            ) : null}

            {cur.key === "purpose" && showsAge(form) ? (
              <Card index={3} style={s.cardGap}>
                <FieldLabel icon="time-outline">Property age</FieldLabel>
                <View style={s.roomRow} accessibilityRole="radiogroup">
                  {PROPERTY_AGES.map((x) => (
                    <ChoicePill key={x} label={x} active={form.age === x} style={s.roomPill} onPress={() => set("age", form.age === x ? "" : x)} />
                  ))}
                </View>
              </Card>
            ) : null}

            {cur.key === "amenities" ? (
              <>
                {/* Section tabs: one group of options on show at a time, each tab carrying its count. */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabs}>
                  {sections.map((sec) => {
                    const on = sec.key === section?.key;
                    const n = countIn(sec);
                    return (
                      <PressableScale key={sec.key} to={0.95} onPress={() => showSection(sec.key)} style={[s.tab, on && s.tabOn]}
                        accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${sec.title}, ${n} selected`}>
                        <Ionicons name={sec.icon} size={15} color={on ? "#fff" : brand.violet} />
                        <Text style={[s.tabText, on && { color: "#fff" }]}>{sec.short}</Text>
                        {n ? <Appear scale style={[s.tabBadge, on && s.tabBadgeOn]}><Text style={[s.tabBadgeText, on && { color: brand.violet }]}>{n}</Text></Appear> : null}
                      </PressableScale>
                    );
                  })}
                </ScrollView>

                {section ? (
                  <Card key={section.key} index={1}>
                    <View style={s.secHead}>
                      <View style={s.secIcon}><Ionicons name={section.icon} size={20} color={brand.violet} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.secTitle}>{section.title}</Text>
                        <Text style={s.secSub}>
                          {section.field === "grade" ? "Choose one" : `${countIn(section)} of ${section.items.length} selected`}
                        </Text>
                      </View>
                      {section.field === "grade" ? null : (
                        <Pressable onPress={() => setAll(section, countIn(section) < section.items.length)} hitSlop={8} style={s.secAll} accessibilityRole="button">
                          <Text style={s.secAllText}>{countIn(section) < section.items.length ? "Select all" : "Clear"}</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={s.tileGrid}>
                      {section.items.map((a) => (
                        <CheckTile key={a} label={a} radio={section.field === "grade"} active={chosenIn(section).includes(a)} onPress={() => pickIn(section.field, a)} />
                      ))}
                    </View>
                    {nextSection ? (
                      <Pressable onPress={() => showSection(nextSection.key)} style={s.secNext} accessibilityRole="button">
                        <Text style={s.secNextText}>Next: {nextSection.title}</Text>
                        <Ionicons name="arrow-forward" size={15} color={brand.violet} />
                      </Pressable>
                    ) : null}
                  </Card>
                ) : null}

                {/* Everything picked so far, across tabs; tap a chip to remove it. */}
                <Card index={2} style={s.cardGap}>
                  <FieldLabel icon="checkmark-done-outline" right={<View style={s.amenCount}><Text style={s.amenCountText}>{picked}</Text></View>}>Your selections</FieldLabel>
                  {allPicked.length ? (
                    <View style={s.chips}>
                      {allPicked.map(([field, a]) => (
                        <Appear key={`${field}:${a}`} scale style={{ maxWidth: "100%" }}>
                          <PressableScale to={0.94} onPress={() => pickIn(field, a)} style={s.chip} accessibilityRole="button" accessibilityLabel={`Remove ${a}`}>
                            <Text style={s.chipText} numberOfLines={1}>{a}</Text>
                            <Ionicons name="close" size={13} color={brand.violet} />
                          </PressableScale>
                        </Appear>
                      ))}
                    </View>
                  ) : (
                    <Text style={s.note}>Nothing picked yet. Choose from the tabs above.</Text>
                  )}
                  <Text style={[s.smallHead, s.gapLg]}>Something else?</Text>
                  <View style={s.addRow}>
                    <TextField style={{ flex: 1 }} value={customAmenity} onChangeText={setCustomAmenity} placeholder="e.g. Terrace garden" maxLength={40}
                      onSubmitEditing={addCustomAmenity} returnKeyType="done" accessibilityLabel="Add another amenity" />
                    <Pressable onPress={addCustomAmenity} style={s.addBtn} accessibilityRole="button" accessibilityLabel="Add amenity">
                      <Ionicons name="add" size={22} color="#fff" />
                    </Pressable>
                  </View>
                </Card>
              </>
            ) : null}

            {cur.key === "details" ? (
              <Card>
                <FieldLabel icon="image-outline" required>Cover Image</FieldLabel>
                {form.cover ? (
                  <View style={s.cover}>
                    <Image source={{ uri: form.cover.uri || form.cover.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <View style={s.coverActions}>
                      <Pressable onPress={uploadCover} disabled={busy} style={s.coverBtn} accessibilityRole="button" accessibilityLabel="Change cover image">
                        {uploading.cover ? <ActivityIndicator size="small" color={brand.ink} /> : <Ionicons name="swap-horizontal" size={15} color={brand.ink} />}
                        <Text style={s.coverBtnText}>Change</Text>
                      </Pressable>
                      <Pressable onPress={() => set("cover", null)} style={s.coverBtn} accessibilityRole="button" accessibilityLabel="Remove cover image">
                        <Ionicons name="trash-outline" size={15} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <UploadBox title="Add cover image" hint="Tap to upload (Max 1 image)" onPress={uploadCover} busy={uploading.cover} error={errors.cover} height={140} />
                )}
                <ErrorText>{errors.cover}</ErrorText>

                <FieldLabel icon="images-outline" style={s.gapLg} right={<Text style={s.count}>{form.photos.length}/{MAX_PHOTOS}</Text>}>Property Photos</FieldLabel>
                <Text style={s.smallHead}>Which room are these photos of?</Text>
                <SelectField title="Photo room" value={activeRoom} onChange={setRoom}
                  options={rooms.map((r) => {
                    const n = form.photos.filter((p) => p.room === r).length;
                    return { value: r, label: n ? `${r} · ${n} photo${n > 1 ? "s" : ""}` : r, icon: ROOM_ICONS[r] || "image-outline" };
                  })} />
                <View style={{ height: 12 }} />
                {form.photos.length < MAX_PHOTOS ? (
                  <UploadBox title={`Add ${activeRoom.toLowerCase()} photo`} hint="Tap to upload or choose from gallery" onPress={uploadPhotos} busy={uploading.photos} />
                ) : (
                  <Text style={s.note}>You've added the maximum of {MAX_PHOTOS} photos.</Text>
                )}
                {roomPhotos.length ? (
                  <View style={[s.thumbs, { marginTop: 12 }]}>
                    {roomPhotos.map((p) => (
                      <View key={p.id} style={s.thumb}>
                        <Image source={{ uri: p.uri || p.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        <Pressable onPress={() => set("photos", form.photos.filter((x) => x.id !== p.id))} hitSlop={8} style={s.thumbX}
                          accessibilityRole="button" accessibilityLabel={`Remove ${activeRoom} photo`}>
                          <Ionicons name="close" size={14} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <FieldLabel icon="document-text-outline" required style={s.gapLg} right={<Text style={s.count}>{form.description.length}/2000</Text>}>Property description</FieldLabel>
                {/* Gemini writes it from the details entered so far; the owner can edit or undo. */}
                <View style={s.aiRow}>
                  <PressableScale to={0.96} onPress={() => writeWithAi()} disabled={writing} style={s.aiBtn}
                    accessibilityRole="button" accessibilityLabel="Write description with AI" accessibilityState={{ busy: writing }}>
                    <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    {writing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={15} color="#fff" />}
                    <Text style={s.aiBtnText}>{writing ? "Writing…" : form.description.trim() ? "Rewrite with AI" : "Write with AI"}</Text>
                  </PressableScale>
                  {beforeAi !== null && !writing ? (
                    <Appear scale>
                      <Pressable onPress={() => { set("description", beforeAi); setBeforeAi(null); }} hitSlop={8} style={s.aiUndo} accessibilityRole="button">
                        <Ionicons name="arrow-undo-outline" size={14} color={brand.violet} />
                        <Text style={s.aiUndoText}>Undo</Text>
                      </Pressable>
                    </Appear>
                  ) : null}
                </View>
                <TextField value={form.description} onChangeText={(v) => { set("description", v); if (beforeAi !== null) setBeforeAi(null); }}
                  placeholder={writing ? "Writing a description from your details…" : "Describe the property, nearby facilities, highlights... or tap Write with AI"}
                  multiline maxLength={2000} accessibilityLabel="Property description" error={errors.description} editable={!writing} />
                <Text style={s.aiNote}>AI uses only the details you've entered. Please check it before submitting.</Text>
              </Card>
            ) : null}

            {cur.key === "review" ? (
              <Card>
                <View style={s.reviewHead}>
                  <Text style={s.reviewTitle}>Listing summary</Text>
                  <Pressable onPress={() => jump(0)} hitSlop={8} style={s.edit} accessibilityRole="button" accessibilityLabel="Edit listing">
                    <Ionicons name="create-outline" size={15} color={brand.violet} />
                    <Text style={s.editText}>Edit</Text>
                  </Pressable>
                </View>
                {form.cover ? <Image source={{ uri: form.cover.uri || form.cover.url }} style={s.reviewCover} resizeMode="cover" /> : null}
                <View style={s.grid}>
                  {summary.map(([icon, k, v, to]) => (
                    <Pressable key={k} onPress={() => jump(to)} style={s.cell} accessibilityRole="button" accessibilityLabel={`${k}: ${v}. Edit`}>
                      <Ionicons name={icon} size={15} color={brand.violet} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.cellKey}>{k}</Text>
                        <Text style={s.cellVal} numberOfLines={2}>{v}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => { Keyboard.dismiss(); set("agreed", !form.agreed); }} style={s.agree} accessibilityRole="checkbox" accessibilityState={{ checked: form.agreed }}>
                  <View style={[s.box, form.agreed && s.boxOn, errors.agreed && { borderColor: colors.error }]}>
                    {form.agreed ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                  </View>
                  <Text style={s.agreeText}>
                    I agree to the <Text style={s.terms}>Terms & Conditions</Text> and confirm that the information provided is accurate.
                  </Text>
                </Pressable>
                <ErrorText>{errors.agreed}</ErrorText>
              </Card>
            ) : null}
          </Animated.View>

          {/* Sits right under the card, as in the design, rather than pinned to the screen bottom. */}
          <View style={s.actions}>
            {ONLY_STEP ? null : last ? (
              <Button title="Submit Property" icon="paper-plane-outline" loading={submitting} disabled={busy} onPress={submit} />
            ) : (
              <Button title="Continue" iconRight="arrow-forward" disabled={busy} onPress={next} />
            )}
          </View>
          </View>
        </ScrollView>
        </KeepVisibleContext.Provider>
      </KeyboardAvoidingView>
    </DropdownHost>
  );
}

// Purpose and category may arrive as route params (e.g. from an older entry point); anything
// else starts the wizard empty.
export default function PostPropertyFormScreen({ navigation, route }) {
  const { listingType, category } = route?.params || {};
  const initial = {
    ...(["rent", "sale"].includes(listingType) ? { listingType } : {}),
    ...(["residential", "commercial"].includes(category) ? { category } : {}),
  };
  return <Wizard navigation={navigation} initial={initial} />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  row: { flexDirection: "row", gap: 12 },
  gap: { marginTop: 18 },
  gapLg: { marginTop: 22 },
  cardGap: { marginTop: 14 },
  locate: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, minHeight: 30, borderRadius: 15, backgroundColor: brand.lavender },
  locateText: { fontSize: 11.5, fontWeight: "700", color: brand.violet },

  specRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  specLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46 },
  specIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  specText: { flexShrink: 1, fontSize: 13.5, fontWeight: "800", color: brand.ink },
  specControl: { width: "52%" },
  areaRow: { flexDirection: "row", gap: 6 },
  unit: { width: 86, paddingHorizontal: 8 },

  priceHint: { fontSize: 12.5, fontWeight: "700", color: brand.violet, marginTop: 6 },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  half: { width: "48.5%" },
  count: { fontSize: 12, fontWeight: "600", color: brand.inkSoft },
  addRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  testBar: { marginBottom: 12, borderStyle: "dashed", borderColor: "#C9B5F5", backgroundColor: "#FCFAFF" },
  testTitle: { fontSize: 12, fontWeight: "800", color: brand.violet, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 38, paddingHorizontal: 16, borderRadius: 19, overflow: "hidden" },
  aiBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  aiUndo: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  aiUndoText: { fontSize: 13, fontWeight: "800", color: brand.violet },
  aiNote: { fontSize: 11.5, color: brand.inkSoft, marginTop: 6 },
  amenCount: { paddingHorizontal: 10, minWidth: 28, minHeight: 24, borderRadius: 12, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  amenCountText: { fontSize: 12, fontWeight: "800", color: brand.violet },
  tabsWrap: { marginHorizontal: -16, marginBottom: 12 },
  tabs: { paddingHorizontal: 16, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.2, borderColor: LINE, backgroundColor: "#fff" },
  tabOn: { backgroundColor: brand.violet, borderColor: brand.violet },
  tabText: { fontSize: 13, fontWeight: "700", color: brand.ink },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  tabBadgeOn: { backgroundColor: "#fff" },
  tabBadgeText: { fontSize: 11, fontWeight: "800", color: brand.violet },
  secHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  secIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  secTitle: { fontSize: 16, fontWeight: "800", color: brand.ink },
  secSub: { fontSize: 12, fontWeight: "600", color: brand.inkSoft, marginTop: 2 },
  secAll: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: brand.lavender, justifyContent: "center" },
  secAllText: { fontSize: 12, fontWeight: "800", color: brand.violet },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  tile: { width: "48.8%", minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.2, borderColor: LINE, backgroundColor: "#fff" },
  tileOn: { borderColor: brand.violet, backgroundColor: brand.lavender },
  tick: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#C9B5F5", alignItems: "center", justifyContent: "center" },
  tickRadio: { borderRadius: 10 },
  tickOn: { backgroundColor: brand.violet, borderColor: brand.violet },
  tileText: { flex: 1, fontSize: 12.5, lineHeight: 16, fontWeight: "600", color: brand.ink },
  tileTextOn: { color: brand.violet, fontWeight: "700" },
  secNext: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, marginTop: 14, borderRadius: 12, borderWidth: 1.2, borderStyle: "dashed", borderColor: "#C9B5F5" },
  secNextText: { fontSize: 13, fontWeight: "800", color: brand.violet },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", minHeight: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: brand.lavender },
  chipText: { flexShrink: 1, fontSize: 12.5, fontWeight: "700", color: brand.violet },
  smallHead: { fontSize: 13, fontWeight: "800", color: brand.ink, marginBottom: 8 },
  addBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: brand.violet, alignItems: "center", justifyContent: "center" },

  cover: { height: 170, borderRadius: 16, overflow: "hidden", backgroundColor: brand.lavender },
  coverActions: { position: "absolute", right: 10, bottom: 10, flexDirection: "row", gap: 8 },
  coverBtn: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.92)" },
  coverBtnText: { fontSize: 12.5, fontWeight: "700", color: brand.ink },
  roomRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  roomPill: { minHeight: 36, paddingHorizontal: 14 },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  thumb: { width: "31.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: brand.lavender },
  thumbX: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(23,19,59,0.65)", alignItems: "center", justifyContent: "center" },
  note: { fontSize: 12.5, color: brand.inkSoft, textAlign: "center", marginTop: 4 },

  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  reviewTitle: { fontSize: 15, fontWeight: "800", color: brand.ink },
  edit: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  editText: { fontSize: 13, fontWeight: "800", color: brand.violet },
  reviewCover: { height: 130, borderRadius: 14, marginBottom: 12, backgroundColor: brand.lavender },
  grid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE },
  cell: { width: "50%", flexDirection: "row", gap: 8, paddingVertical: 10, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  cellKey: { fontSize: 11.5, color: brand.inkSoft, fontWeight: "600" },
  cellVal: { fontSize: 13.5, color: brand.ink, fontWeight: "700", marginTop: 1 },
  agree: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 16 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#C9B5F5", alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { backgroundColor: brand.violet, borderColor: brand.violet },
  agreeText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: brand.inkSoft },
  terms: { color: brand.violet, fontWeight: "700" },

  apiErr: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#FFF0F0", borderRadius: 12, padding: 12, marginBottom: 12 },
  apiErrText: { flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 },
  actions: { marginTop: 18 },

});
