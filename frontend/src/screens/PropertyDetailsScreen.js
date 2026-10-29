import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Cover, badgeFor } from "../components/PropertyCard";
import HeartButton from "../components/HeartButton";
import Button from "../components/Button";
import Input from "../components/Input";
import BottomSheet from "../components/BottomSheet";
import PressableScale from "../components/PressableScale";
import ReviewsSection from "../components/Reviews";
import { Stars } from "../components/Stars";
import { ErrorState, LoadingState } from "../components/StateViews";
import { useCompare } from "../context/CompareContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import { isPresent } from "../utils/format";
import { colors, fonts, radius, shadow } from "../theme";

const { width: W } = Dimensions.get("window");
const GAL_H = Math.round(W * 0.82);

function Block({ title, children }) {
  return (
    <View style={styles.block}>
      <Text style={styles.bt}>{title}</Text>
      {children}
    </View>
  );
}
function Tags({ list }) {
  return (
    <View style={styles.tags}>
      {list.map((t) => (
        <View key={t} style={styles.tag}>
          <Text style={styles.tagText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Gallery({ images }) {
  const [i, setI] = useState(0);
  if (!images.length)
    return <Cover uri="" style={{ width: W, height: GAL_H }} iconSize={64} />;
  return (
    <View>
      <FlatList
        data={images}
        keyExtractor={(u) => u}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setI(Math.round(e.nativeEvent.contentOffset.x / W))
        }
        renderItem={({ item }) => (
          <Cover uri={item} style={{ width: W, height: GAL_H }} iconSize={64} />
        )}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
      />
      {images.length > 1 ? (
        <>
          <View style={styles.dots}>
            {images.slice(0, 10).map((u, k) => (
              <View key={u} style={[styles.dot, k === i && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.count}>
            <Ionicons name="images-outline" size={13} color={colors.white} />
            <Text style={styles.countText}>
              {i + 1}/{images.length}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default function PropertyDetailsScreen({ navigation, route }) {
  const { id, preview } = route.params;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const cmp = useCompare();
  const { user, token, openLoginPrompt } = useAuth();
  const { data, loading, error, reload, refresh } = useApi(
    () => api.property(id),
    [id],
  );
  const p = data?.property || preview;
  const [enq, setEnq] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const tick = useRef(new Animated.Value(0)).current;

  const open = (url) =>
    Linking.openURL(url).catch(() =>
      toast.show("Could not open this link", "error"),
    );
  const share = () =>
    Share.share({
      message:
        `${p.title}${p.price ? ` · ${p.price}` : ""}${p.city ? ` · ${p.city}` : ""}\n${p.sourceUrl || ""}`.trim(),
    }).catch(() => {});

  const send = async () => {
    setSending(true);
    try {
      await api.enquire(
        p.id,
        msg.trim() || `I'm interested in ${p.title}. Please contact me.`,
        user?.name,
      );
      setSent(true);
      tick.setValue(0);
      Animated.spring(tick, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        setEnq(false);
        setSent(false);
        setMsg("");
      }, 1500);
    } catch (e) {
      toast.show(e.message, "error");
    } finally {
      setSending(false);
    }
  };

  if (!p)
    return (
      <View style={styles.root}>
        <View style={{ paddingTop: insets.top + 60 }}>
          {loading ? (
            <View style={{ padding: 20 }}>
              <LoadingState rows={3} />
            </View>
          ) : (
            <ErrorState
              title="Unable to load property"
              error={error}
              onRetry={reload}
            />
          )}
        </View>
      </View>
    );

  const where = [p.locality, p.city].filter(Boolean).join(", ");
  const badge = badgeFor(p);
  const facts = [
    ["BHK", p.bhk && `${p.bhk} BHK`],
    ["Area", p.area],
    ["Type", p.propertyType],
    ["Possession", p.possessionStatus],
    [
      "Floor",
      [p.floor, p.totalFloors && `of ${p.totalFloors}`]
        .filter(Boolean)
        .join(" "),
    ],
    ["Parking", p.parkings],
    ["Facing", p.facing],
    ["Furnishing", p.furnishing],
    ["Bathrooms", p.bathrooms],
    ["Balconies", p.balconies],
    ["Wing", p.wing],
    ["Age", p.ageOfProperty],
    ["Units available", p.unitsAvailable],
  ].filter(([, v]) => isPresent(v));
  const inCompare = cmp.has(p.id);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
      >
        <Gallery
          images={
            p.galleryImages?.length ? p.galleryImages : p.image ? [p.image] : []
          }
        />
        <View style={styles.sheet}>
          {p.approvalStatus && p.approvalStatus !== "approved" ? (
            <View style={styles.pending}>
              <Ionicons name="time-outline" size={16} color={colors.goldDeep} />
              <Text style={styles.pendingText}>
                {p.approvalStatus === "pending"
                  ? "Awaiting admin approval – only you can see this."
                  : "This listing was not approved."}
              </Text>
            </View>
          ) : null}
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
          <Text style={styles.title}>{p.title}</Text>
          {where ? (
            <View style={styles.locRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.goldDeep}
              />
              <Text style={styles.loc}>
                {where}
                {p.pincode ? ` – ${p.pincode}` : ""}
              </Text>
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              {p.price ? (
                <Text style={styles.price}>
                  {p.priceMin ? `${p.priceMin} – ${p.price}` : p.price}
                </Text>
              ) : (
                <Text style={styles.poa}>Price on request</Text>
              )}
              {p.emi ? <Text style={styles.emi}>EMI from {p.emi}</Text> : null}
            </View>
            {p.rating ? (
              <View style={styles.rate}>
                <Stars value={p.rating.average} size={13} />
                <Text style={styles.rateText}>
                  {p.rating.average.toFixed(1)} · {p.rating.count}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <PressableScale
              onPress={() => cmp.toggle(p.id)}
              style={[
                styles.act,
                inCompare && {
                  backgroundColor: colors.gold,
                  borderColor: colors.gold,
                },
              ]}
            >
              <Ionicons
                name={inCompare ? "checkmark" : "swap-horizontal"}
                size={18}
                color={colors.ink}
              />
              <Text style={styles.actText}>
                {inCompare ? "In compare" : "Compare"}
              </Text>
            </PressableScale>
            <PressableScale onPress={share} style={styles.act}>
              <Ionicons
                name="share-social-outline"
                size={18}
                color={colors.ink}
              />
              <Text style={styles.actText}>Share</Text>
            </PressableScale>
            {p.mapLink ? (
              <PressableScale
                onPress={() => open(p.mapLink)}
                style={styles.act}
              >
                <Ionicons
                  name="navigate-outline"
                  size={18}
                  color={colors.ink}
                />
                <Text style={styles.actText}>Map</Text>
              </PressableScale>
            ) : null}
          </View>

          {facts.length ? (
            <View style={styles.grid}>
              {facts.map(([k, v]) => (
                <View key={k} style={styles.fact}>
                  <Text style={styles.fk}>{k}</Text>
                  <Text style={styles.fv} numberOfLines={2}>
                    {v}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {p.developerName ? (
            <Block title="Developer">
              <View style={styles.dev}>
                {p.developerAvatar ? (
                  <Image
                    source={{ uri: p.developerAvatar }}
                    style={styles.devImg}
                  />
                ) : (
                  <View
                    style={[
                      styles.devImg,
                      {
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.champagneSoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name="business-outline"
                      size={22}
                      color={colors.goldDeep}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.devName}>{p.developerName}</Text>
                  {p.reraNumber ? (
                    <Text style={styles.rera}>RERA · {p.reraNumber}</Text>
                  ) : null}
                </View>
              </View>
            </Block>
          ) : p.reraNumber ? (
            <Block title="RERA">
              <Text style={styles.body}>{p.reraNumber}</Text>
            </Block>
          ) : null}

          {p.address ? (
            <Block title="Address">
              <Text style={styles.body}>{p.address}</Text>
            </Block>
          ) : null}
          {p.description ? (
            <Block title="About">
              <Text style={styles.body}>{p.description}</Text>
            </Block>
          ) : null}
          {p.longDescription && p.longDescription !== p.description ? (
            <Block title="More details">
              <Text style={styles.body}>{p.longDescription}</Text>
            </Block>
          ) : null}
          {p.amenities.length ? (
            <Block title="Amenities">
              <Tags list={p.amenities} />
            </Block>
          ) : null}
          {p.facilities.length ? (
            <Block title="Facilities">
              <Tags list={p.facilities} />
            </Block>
          ) : null}
          {p.security.length ? (
            <Block title="Security">
              <Tags list={p.security} />
            </Block>
          ) : null}

          {p.floorPlans.length ? (
            <Block title="Floor plans">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {p.floorPlans.map((u) => (
                  <Pressable key={u} onPress={() => open(u)}>
                    <Cover uri={u} style={styles.plan} />
                  </Pressable>
                ))}
              </ScrollView>
            </Block>
          ) : null}
          {p.virtualTours.length || p.brochure || p.sourceUrl ? (
            <Block title="Explore more">
              <View style={{ gap: 10 }}>
                {p.virtualTours.map((u, i) => (
                  <Button
                    key={u}
                    variant="ghost"
                    small
                    icon="play-circle-outline"
                    title={
                      p.virtualTours.length > 1
                        ? `Virtual tour ${i + 1}`
                        : "Virtual tour"
                    }
                    onPress={() => open(u)}
                  />
                ))}
                {p.brochure ? (
                  <Button
                    variant="ghost"
                    small
                    icon="download-outline"
                    title="Download brochure"
                    onPress={() => open(p.brochure)}
                  />
                ) : null}
                {p.sourceUrl ? (
                  <Button
                    variant="ghost"
                    small
                    icon="map-outline"
                    title="View on website"
                    onPress={() => open(p.sourceUrl)}
                  />
                ) : null}
              </View>
            </Block>
          ) : null}

          {/* <Block title="Ratings & reviews">
            <ReviewsSection
              propertyId={p.id}
              isOwner={!!data?.property?.isOwner}
              onChanged={refresh}
            />
          </Block> */}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <PressableScale to={0.88} onPress={() => navigation.goBack()} style={styles.round} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </PressableScale>
        <HeartButton id={p.id} size={21} style={{ width: 44, height: 44, borderRadius: 22 }} />
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
        {/* Frosted Glass Layers */}
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.95)", "rgba(246, 242, 255, 0.9)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0.2)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaSpecular}
          pointerEvents="none"
        />
        <View style={{ flex: 1, zIndex: 1 }}>
          <Text style={styles.ctaLabel}>{p.priceMin ? 'Starting from' : 'Price'}</Text>
          <Text style={styles.ctaPrice} numberOfLines={1}>{p.priceMin || p.price || 'On request'}</Text>
        </View>
        <Button
          title="Enquire Now"
          icon="chatbubble-ellipses-outline"
          onPress={() => {
            if (!token) {
              openLoginPrompt({
                reason: "enquiry",
                title: "Sign In to Enquire",
                message: `Please sign in to connect directly with the builder for ${p.title || "this property"}.`,
              });
              return;
            }
            setEnq(true);
          }}
          style={{ flex: 1.4, zIndex: 1 }}
        />
      </View>

      <BottomSheet
        visible={enq}
        onClose={() => !sending && setEnq(false)}
        title="Enquire about this project"
      >
        {sent ? (
          <View style={{ alignItems: "center", paddingVertical: 28 }}>
            <Animated.View
              style={[styles.okCircle, { transform: [{ scale: tick }] }]}
            >
              <Ionicons name="checkmark" size={36} color={colors.white} />
            </Animated.View>
            <Text style={styles.okTitle}>Enquiry sent</Text>
            <Text style={styles.okSub}>
              We will contact you on +91 {user?.phone} shortly.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.enqFor} numberOfLines={1}>
              {p.title}
            </Text>
            {/* <Input
              label="MESSAGE (OPTIONAL)"
              value={msg}
              onChangeText={setMsg}
              multiline
              maxLength={1000}
              placeholder="Ask about price, availability, site visit…"
            /> */}
            <Text style={styles.enqNote}>
              We will share your mobile number (+91 {user?.phone}) with the
              project team.
            </Text>
            <Button
              title="Send enquiry"
              onPress={send}
              loading={sending}
              style={{ marginTop: 14 }}
            />
          </>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  sheet: { marginTop: -28, backgroundColor: colors.ivory, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glass,
  },
  dots: { position: 'absolute', bottom: 42, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 20, backgroundColor: colors.gold },
  count: { position: 'absolute', right: 16, bottom: 44, flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: 'rgba(20,10,46,0.65)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  countText: { color: colors.white, fontSize: 11.5, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(201, 162, 255, 0.9)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 10 },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.ink, letterSpacing: 0.5 },
  pending: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(235, 226, 255, 0.85)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', borderRadius: radius.md, padding: 12, marginBottom: 12 },
  pendingText: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '600' },
  title: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34, color: colors.ink },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  loc: { flex: 1, color: colors.muted, fontSize: 14 },
  priceRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  price: { fontSize: 26, fontWeight: "800", color: colors.goldDeep },
  poa: { fontSize: 18, fontWeight: "700", color: colors.muted },
  emi: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  rate: { alignItems: 'flex-end', gap: 4 },
  rateText: { fontSize: 12, fontWeight: '800', color: colors.ink },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.95)', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 15, height: 42, ...shadow.glass },
  actText: { fontWeight: '700', fontSize: 13, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  fact: { width: '48%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.md, padding: 13, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.95)', ...shadow.glass },
  fk: { fontSize: 10.5, fontWeight: '800', color: colors.muted, letterSpacing: 0.9, textTransform: 'uppercase' },
  fv: { fontSize: 14.5, fontWeight: '700', color: colors.ink, marginTop: 4 },
  block: { marginTop: 28 },
  bt: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.ink,
    marginBottom: 12,
  },
  body: { fontSize: 14.5, lineHeight: 23, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: 'rgba(228, 219, 250, 0.85)', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  tagText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  dev: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg, padding: 14, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.95)', ...shadow.glass },
  devImg: { width: 52, height: 52, borderRadius: 16 },
  devName: { fontSize: 16, fontWeight: "800", color: colors.ink },
  rera: { fontSize: 12, color: colors.muted, marginTop: 3 },
  plan: { width: 220, height: 160, borderRadius: radius.md },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.95)', ...shadow.glassFloat },
  ctaSpecular: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  ctaLabel: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  ctaPrice: { fontSize: 19, fontWeight: '800', color: colors.ink },
  enqFor: { fontWeight: '800', color: colors.ink, marginBottom: 12, fontSize: 15 },
  enqNote: { fontSize: 12, color: colors.muted, marginTop: 10 },
  okCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  okTitle: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.ink,
    marginTop: 16,
  },
  okSub: { color: colors.muted, marginTop: 6, textAlign: "center" },
});
