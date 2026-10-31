import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Button from "../components/Button";
import {
  Card, ChoicePill, ChoiceTile, DropdownHost, ErrorText, FieldLabel, KeepVisibleContext, LINE, SelectField, Stepper, TextField, TogglePill, UploadBox, WizardHeader,
} from "../components/postProperty/Parts";
import Submitted from "../components/postProperty/Submitted";
import { useAuth } from "../context/AuthContext";
import { useLocationAccess } from "../context/LocationAccessContext";
import { useBottomSpace } from "../hooks/useBottomSpace";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { formatInr } from "../utils/format";
import { getCurrentUserLocation } from "../services/locationService";
import {
  AREA_UNITS, BATHROOMS, BHKS, CATEGORY_OPTIONS, CUSTOM_DATE, EMPTY_FORM, FACINGS, FURNISHING, FURNISHING_ICONS, LISTING_OPTIONS, MAX_PHOTOS, PARKING,
  PARKING_ICONS, TYPE_ICONS,
  RENT_AVAILABILITY, SALE_POSSESSION, STEPS, amenitiesFor, availabilityText, buildPayload, firstInvalidStep,
  maskDate, needsBhk, photoRoomsFor, priceLabel, sanitizeForType, showsBuildingFields, typeLabel, typesFor, validateStep,
} from "../utils/postPropertyFlow";
import { brand, colors } from "../theme";
import Text from "../components/AppText";

// Which step owns a backend field error, so server-side validation can send the user to the right place.
const FIELD_STEP = {
  listingType: 0, category: 0, title: 0, propertyType: 0, city: 0, locality: 0,
  bhk: 1, area: 1, bathrooms: 1, totalFloors: 1, furnishing: 1,
  price: 2, images: 4, description: 4,
};

const FIELD_GAP = 24;
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
  const [form, setForm] = useState(() => sanitizeForType({ ...EMPTY_FORM, ...initial }));
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [uploading, setUploading] = useState({ cover: false, photos: false });
  const [room, setRoom] = useState("");
  const [customAmenity, setCustomAmenity] = useState("");
  const [locating, setLocating] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;
  const rent = form.listingType === "rent";
  const building = showsBuildingFields(form.propertyType);
  const rooms = photoRoomsFor(form.category, form.propertyType);
  const activeRoom = rooms.includes(room) ? room : rooms[0];
  const busy = uploading.cover || uploading.photos;

  const update = (fn) => setForm((f) => sanitizeForType(fn(f)));
  const set = (key, value) => {
    update((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setApiError("");
  };

  // Animate between steps and keep the scroll position at the top of each step.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
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

  const jump = (i) => { setErrors({}); setStep(i); };

  // Once the keyboard has opened (and the scroll area has shrunk), make sure the whole focused
  // field, border included, sits at least FIELD_GAP above the keyboard.
  const keepVisible = useCallback((node) => {
    setTimeout(() => {
      if (!node || !content.current) return;
      node.measureLayout(content.current, (x, y, w, h) => {
        const needed = y + h + FIELD_GAP - viewportH.current;
        if (needed > scrollY.current) scroll.current?.scrollTo({ y: needed, animated: true });
      }, () => {});
    }, 350);
  }, []);

  const next = () => {
    const e = validateStep(cur.key, form);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.show("Please fix the highlighted fields", "error");
      return;
    }
    // Photos upload to the account, so sign-in is asked for before the details steps.
    if (step === 0 && !token) return askLogin();
    setStep((n) => Math.min(n + 1, STEPS.length - 1));
  };

  const locate = async () => {
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
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
    });
    return res.canceled ? [] : (res.assets || []).slice(0, limit);
  };

  const uploadCover = async () => {
    const [asset] = await pick(1);
    if (!asset) return;
    setUploading((u) => ({ ...u, cover: true }));
    try {
      const { url } = await api.uploadImage(asset);
      set("cover", { uri: asset.uri, url });
    } catch (e) {
      toast.show(e?.message || "Could not upload the image", "error");
    } finally {
      setUploading((u) => ({ ...u, cover: false }));
    }
  };

  const uploadPhotos = async () => {
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
      } catch {
        failed += 1;
      }
    }
    setUploading((u) => ({ ...u, photos: false }));
    if (failed) toast.show(`${failed} photo${failed > 1 ? "s" : ""} could not be uploaded`, "error");
  };

  const addCustomAmenity = () => {
    const a = customAmenity.trim().slice(0, 40);
    if (!a) return;
    if (!form.amenities.some((x) => x.toLowerCase() === a.toLowerCase()) && form.amenities.length < 30) set("amenities", [...form.amenities, a]);
    setCustomAmenity("");
  };

  const submit = async () => {
    if (submitting || busy) return;
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

  const priceNum = Number(form.price);
  const roomPhotos = form.photos.filter((p) => p.room === activeRoom);
  const summary = [
    ["swap-horizontal-outline", "Purpose", labelOf(LISTING_OPTIONS, form.listingType), 0],
    ["grid-outline", "Category", labelOf(CATEGORY_OPTIONS, form.category), 0],
    ["business-outline", "Type", typeLabel(form.propertyType), 0],
    ["location-outline", "Location", [form.locality.trim(), form.city.trim()].filter(Boolean).join(", "), 0],
    ["bed-outline", "Bedrooms", needsBhk(form.category, form.propertyType) && form.bhk ? `${form.bhk} BHK` : "", 1],
    ["water-outline", "Bathrooms", building ? form.bathrooms : "", 1],
    ["resize-outline", "Area", form.area ? `${form.area} ${labelOf(AREA_UNITS, form.areaUnit)}` : "", 1],
    ["layers-outline", "Total floors", building ? form.totalFloors : "", 1],
    ["compass-outline", "Facing", form.facing, 1],
    ["car-outline", "Parking", form.parking, 1],
    ["bed-outline", "Furnishing", building ? form.furnishing : "", 1],
    ["pricetag-outline", priceLabel(form.listingType), priceNum > 0 ? `${formatInr(priceNum)}${rent ? " / month" : ""}` : "", 2],
    ["calendar-outline", rent ? "Available from" : "Possession", availabilityText(form), 2],
    ["sparkles-outline", "Amenities", form.amenities.length ? `${form.amenities.length} selected` : "", 3],
    ["images-outline", "Photos", `${(form.cover ? 1 : 0) + form.photos.length} added`, 4],
  ].filter((r) => r[2]);

  return (
    <DropdownHost style={s.root}>
      <StatusBar style="dark" />
      <WizardHeader title={cur.heading || "Post your property"} subtitle={cur.subtitle} onBack={goBack} />
      <Stepper steps={STEPS} step={step} onJump={jump} />

      {/* The scroll area stops at the system navigation bar, so the form never slides under it. */}
      {/* "padding" on Android too: the app draws edge-to-edge, so the window no longer shrinks for the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1, marginBottom: bottom }} behavior="padding">
        <KeepVisibleContext.Provider value={keepVisible}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}
          scrollEventThrottle={32} onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height; }}>
          <View ref={content} collapsable={false} style={s.scroll}>
          <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
            {apiError ? <View style={s.apiErr}><Ionicons name="alert-circle-outline" size={19} color={colors.error} /><Text style={s.apiErrText}>{apiError}</Text></View> : null}

            {cur.key === "purpose" ? (
              <Card>
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
                  <TextField style={{ flex: 1 }} label="City" required value={form.city} onChangeText={(v) => set("city", v)} placeholder="e.g. Mumbai" autoCapitalize="words" maxLength={60} error={errors.city} />
                  <TextField style={{ flex: 1 }} label="Locality / Area" required value={form.locality} onChangeText={(v) => set("locality", v)} placeholder="e.g. Andheri West" autoCapitalize="words" maxLength={80} error={errors.locality} />
                </View>
              </Card>
            ) : null}

            {cur.key === "specs" ? (
              <Card>
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

            {cur.key === "pricing" ? (
              <Card>
                <FieldLabel icon="pricetag-outline" required>{priceLabel(form.listingType)}</FieldLabel>
                <TextField prefix="₹" value={form.price ? Number(form.price).toLocaleString("en-IN") : ""} onChangeText={(v) => set("price", v.replace(/\D/g, "").slice(0, 12))}
                  placeholder={rent ? "25,000" : "2,50,00,000"} keyboardType="number-pad" accessibilityLabel={priceLabel(form.listingType)} error={errors.price} />
                {priceNum > 0 && !errors.price ? <Text style={s.priceHint}>{formatInr(priceNum)}{rent ? " per month" : ""}</Text> : null}

                <FieldLabel icon="calendar-outline" style={s.gapLg}>{rent ? "Available from" : "Possession status"}</FieldLabel>
                <View style={s.pillGrid} accessibilityRole="radiogroup">
                  {(rent ? RENT_AVAILABILITY : SALE_POSSESSION).map((x) => (
                    <ChoicePill key={x} label={x} active={form.availability === x} style={s.half} onPress={() => set("availability", form.availability === x ? "" : x)} />
                  ))}
                </View>
                {rent && form.availability === CUSTOM_DATE ? (
                  <TextField style={{ marginTop: 12 }} label="Available from" required value={form.availableDate} onChangeText={(v) => set("availableDate", maskDate(v))}
                    placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} error={errors.availableDate} />
                ) : null}
              </Card>
            ) : null}

            {cur.key === "amenities" ? (
              <Card>
                <FieldLabel icon="sparkles-outline" right={<Text style={s.count}>{form.amenities.length} selected</Text>}>Amenities & features</FieldLabel>
                <View style={s.pillGrid}>
                  {[...amenitiesFor(form.category), ...form.amenities.filter((a) => !amenitiesFor(form.category).includes(a))].map((a) => (
                    <TogglePill key={a} label={a} active={form.amenities.includes(a)} onPress={() => set("amenities", toggle(form.amenities, a))} />
                  ))}
                </View>
                <View style={[s.addRow, s.gapLg]}>
                  <TextField style={{ flex: 1 }} value={customAmenity} onChangeText={setCustomAmenity} placeholder="Add another, e.g. Terrace garden" maxLength={40}
                    onSubmitEditing={addCustomAmenity} returnKeyType="done" accessibilityLabel="Add another amenity" />
                  <Pressable onPress={addCustomAmenity} style={s.addBtn} accessibilityRole="button" accessibilityLabel="Add amenity">
                    <Ionicons name="add" size={22} color="#fff" />
                  </Pressable>
                </View>
              </Card>
            ) : null}

            {cur.key === "details" ? (
              <Card>
                <FieldLabel icon="document-text-outline" required right={<Text style={s.count}>{form.description.length}/2000</Text>}>Property description</FieldLabel>
                <TextField value={form.description} onChangeText={(v) => set("description", v)} placeholder="Describe the property, nearby facilities, highlights..."
                  multiline maxLength={2000} accessibilityLabel="Property description" error={errors.description} />

                <FieldLabel icon="image-outline" required style={s.gapLg}>Cover Image</FieldLabel>
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
                <View style={s.roomRow} accessibilityRole="radiogroup">
                  {rooms.map((r) => {
                    const n = form.photos.filter((p) => p.room === r).length;
                    return <ChoicePill key={r} label={n ? `${r} · ${n}` : r} active={r === activeRoom} onPress={() => setRoom(r)} style={s.roomPill} />;
                  })}
                </View>
                {roomPhotos.length ? (
                  <View style={s.thumbs}>
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
                {form.photos.length < MAX_PHOTOS ? (
                  <UploadBox title={`Add ${activeRoom.toLowerCase()} photo`} hint="Tap to upload or choose from gallery" onPress={uploadPhotos} busy={uploading.photos} />
                ) : (
                  <Text style={s.note}>You've added the maximum of {MAX_PHOTOS} photos.</Text>
                )}
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
                <Pressable onPress={() => set("agreed", !form.agreed)} style={s.agree} accessibilityRole="checkbox" accessibilityState={{ checked: form.agreed }}>
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
            {last ? (
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
  locate: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, minHeight: 30, borderRadius: 15, backgroundColor: brand.lavender },
  locateText: { fontSize: 11.5, fontWeight: "700", color: brand.violet },

  specRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  specLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 46 },
  specIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: brand.lavender, alignItems: "center", justifyContent: "center" },
  specText: { flexShrink: 1, fontSize: 13.5, fontWeight: "700", color: brand.ink },
  specControl: { width: "52%" },
  areaRow: { flexDirection: "row", gap: 6 },
  unit: { width: 86, paddingHorizontal: 8 },

  priceHint: { fontSize: 12.5, fontWeight: "700", color: brand.violet, marginTop: 6 },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  half: { width: "48.5%" },
  count: { fontSize: 12, fontWeight: "600", color: brand.inkSoft },
  addRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
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
