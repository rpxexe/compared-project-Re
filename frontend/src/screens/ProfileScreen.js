import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import CountUp from '../components/CountUp';
import { stagger } from '../components/Reveal';
import { isReducedMotion } from '../hooks/useReducedMotion';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { useCompare } from '../context/CompareContext';
import { api } from '../services/api';
import {
  getCompareHistory, getSearchHistory, getViewHistory, subscribeCompareHistory, subscribeSearchHistory,
} from '../services/historyService';
import { PURPOSES } from './RoleScreen';
import { formatPhone, listingName, roleLabel, timeAgo } from '../utils/format';
import { brand, colors, fonts, gradients, radius, shadow } from '../theme';
import Text from "../components/AppText";

const LISTING_STATUS = [
  { key: 'approved', label: 'Live', color: colors.success },
  { key: 'pending', label: 'Pending', color: brand.goldBright },
  { key: 'rejected', label: 'Rejected', color: colors.error },
];

// Stat tiles a developer sees for each listing status.
const LISTING_STAT_STYLE = {
  approved: { icon: 'checkmark-circle-outline', tint: colors.success, bg: '#E2F5EE' },
  pending: { icon: 'hourglass-outline', tint: '#B7791F', bg: '#FDF3DC' },
  rejected: { icon: 'close-circle-outline', tint: colors.error, bg: '#F6E3E3' },
};

const QUICK_ACTIONS = [
  { label: 'Post', icon: 'add-circle-outline', to: ['Post'] },
  { label: 'Explore', icon: 'search-outline', to: ['Explore'] },
  { label: 'Compare', icon: 'swap-horizontal', to: ['Compare', { screen: 'CompareMain' }] },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Springy entrance used across the dashboard. `from`: "up" (rise), "pop" (scale up from small),
// "right" (slide in from the side). Settles with a little overshoot instead of a plain fade.
function SpringIn({ delay = 0, from = 'up', style, children }) {
  const reduced = isReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(v, { toValue: 1, delay, speed: 9, bounciness: 9, useNativeDriver: true }).start();
  }, [v, delay, reduced]);
  const opacity = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const transform =
    from === 'pop' ? [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]
      : from === 'right' ? [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
        : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }];
  return <Animated.View style={[style, { opacity, transform }]}>{children}</Animated.View>;
}

// A one-shot "hop" (rise, squash, settle) for an icon, after `delay`; replays when `trigger` changes.
function useHop(delay = 0, trigger) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReducedMotion()) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 620, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v, delay, trigger]);
  return {
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [0, -7, 0, 0] }) },
      { scale: v.interpolate({ inputRange: [0, 0.35, 0.7, 0.85, 1], outputRange: [1, 1.08, 0.9, 1.04, 1] }) },
      { rotate: v.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: ['0deg', '-10deg', '6deg', '0deg'] }) },
    ],
  };
}

// Soft light band that sweeps across the hero card on load, then again every few seconds.
function Shimmer() {
  const v = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!w || isReducedMotion()) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(4200),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, w]);
  return (
    <View style={styles.shineClip} pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Animated.View style={[styles.shine, { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-160, w + 60] }) }, { rotate: '18deg' }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// Ring that ripples out from the avatar now and then.
function Ripple() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReducedMotion()) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ripple, { opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }] }]}
    />
  );
}

function StatTile({ icon, label, value, tint, bg, locked, onPress, index = 0 }) {
  const hop = useHop(420 + index * 70);
  return (
    <PressableScale onPress={onPress} to={0.93} style={styles.tile} accessibilityRole="button" accessibilityLabel={`${label}: ${locked ? 'sign in to view' : value}`}>
      <Animated.View style={[styles.tileIc, { backgroundColor: bg }, hop]}><Ionicons name={icon} size={18} color={tint} /></Animated.View>
      {locked ? (
        <Ionicons name="lock-closed-outline" size={22} color={colors.muted} style={{ marginTop: 14, marginBottom: 6 }} />
      ) : (
        <CountUp value={value} style={styles.tileV} />
      )}
      <Text style={styles.tileL}>{label}</Text>
    </PressableScale>
  );
}

// Quick action whose icon gives a hop each time it's tapped.
function ActionTile({ label, icon, onPress }) {
  const [taps, setTaps] = useState(0);
  const hop = useHop(0, taps);
  return (
    <PressableScale onPress={() => { setTaps((n) => n + 1); onPress(); }} to={0.9} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[styles.actionIc, taps ? hop : null]}><Ionicons name={icon} size={22} color={colors.goldDeep} /></Animated.View>
      <Text style={styles.actionL}>{label}</Text>
    </PressableScale>
  );
}

// Listing status bar that grows in from the left once it appears.
function GrowBar({ children }) {
  const reduced = isReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(v, { toValue: 1, duration: 900, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, reduced]);
  return <Animated.View style={[styles.bar, { transformOrigin: 'left', transform: [{ scaleX: v }] }]}>{children}</Animated.View>;
}

function Row({ icon, label, onPress, danger, last }) {
  return (
    <PressableScale onPress={onPress} to={0.97} style={[styles.row, !last && styles.border]} accessibilityRole="button">
      <View style={[styles.ic, danger && { backgroundColor: '#F6E3E3' }]}><Ionicons name={icon} size={19} color={danger ? colors.error : colors.goldDeep} /></View>
      <Text style={[styles.rl, danger && { color: colors.error }]}>{label}</Text>
      {!danger ? <Ionicons name="chevron-forward" size={18} color="#B5AFBB" /> : null}
    </PressableScale>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, token, isDeveloper, signOut } = useAuth();
  const saved = useSaved();
  const cmp = useCompare();
  const isGuest = !token;
  const purpose = PURPOSES.find((p) => p.key === user?.purpose)?.label;
  const displayName = user?.name || user?.fullName || (isGuest ? 'Guest User' : 'Verified User');
  const displayContact = user?.email || (user?.phone ? formatPhone(user.phone) : (isGuest ? 'Browsing Mode' : ''));
  const initial = displayName.charAt(0).toUpperCase();

  // Account-only data; skipped for guests so the sign-in dialog doesn't pop up on a 401.
  const listings = useApi(() => api.myProperties(), [token], { enabled: !isGuest });
  // Developers don't browse, so they have no enquiries or viewed properties of their own.
  const buyer = !isGuest && !isDeveloper;
  const enquiries = useApi(() => api.myEnquiries(), [token], { enabled: buyer });
  const views = useApi(() => api.myViews(), [token], { enabled: buyer });
  const [compareHistory, setCompareHistory] = useState([]);
  const [searchCount, setSearchCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getCompareHistory().then(setCompareHistory);
    const unsubCompare = subscribeCompareHistory(setCompareHistory);
    const unsubSearch = subscribeSearchHistory((list) => setSearchCount(list.length));
    return () => { unsubCompare(); unsubSearch(); };
  }, []);

  // Views have no change listener, so search/view counts are re-read whenever the tab is shown.
  const loadLocalCounts = () =>
    Promise.all([getSearchHistory(), getViewHistory()]).then(([s, v]) => { setSearchCount(s.length); setViewCount(v.length); });

  useEffect(() => navigation.addListener('focus', () => {
    loadLocalCounts();
    if (!isGuest) listings.refresh();
    if (buyer) { enquiries.refresh(); views.refresh(); }
  }), [navigation, isGuest, buyer]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLocalCounts(), ...(isGuest ? [] : [listings.refresh()]), ...(buyer ? [enquiries.refresh(), views.refresh()] : [])]);
    setRefreshing(false);
  };

  const listingItems = listings.data?.items || [];
  const enquiryItems = enquiries.data?.items || [];
  const statusCounts = LISTING_STATUS.map((s) => ({
    ...s,
    count: listingItems.filter((p) => (p.approvalStatus || 'approved') === s.key).length,
  }));

  // Newest enquiries and comparisons, merged into one feed.
  const activity = [
    ...enquiryItems.map((e) => ({
      id: `e_${e.id}`, icon: 'chatbubble-ellipses-outline', tint: '#3B6FE0', bg: '#E3EEFF',
      title: e.propertyTitle || 'Property', meta: `Enquiry · ${e.status}`, at: new Date(e.createdAt).getTime(),
      onPress: () => navigation.navigate('MyEnquiries'),
    })),
    ...compareHistory.map((c) => ({
      id: c.id, icon: 'swap-horizontal', tint: brand.violet, bg: brand.lavender,
      title: c.properties.map(listingName).join('  vs  '), meta: `Compared ${c.ids.length} properties`, at: c.timestamp,
      onPress: () => { cmp.replace(c.ids); navigation.navigate('Compare', { screen: 'CompareMain' }); },
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 4);

  const needLogin = () => navigation.navigate('Login');
  const manage = () => navigation.navigate('MyProperties');
  const developerStats = [
    { label: 'Listings', icon: 'home-outline', tint: colors.goldDeep, bg: colors.champagneSoft, value: listingItems.length, onPress: manage },
    ...statusCounts.map((st) => ({ label: st.label, ...LISTING_STAT_STYLE[st.key], value: st.count, onPress: manage })),
  ];
  const stats = isDeveloper ? developerStats : [
    { label: 'Saved', icon: 'heart-outline', tint: '#D6336C', bg: '#FDE7EF', value: saved.count, onPress: () => navigation.navigate('Saved') },
    { label: 'Listings', icon: 'home-outline', tint: colors.goldDeep, bg: colors.champagneSoft, value: listingItems.length, locked: isGuest, onPress: isGuest ? needLogin : () => navigation.navigate('MyProperties') },
    { label: 'Enquiries', icon: 'chatbubble-ellipses-outline', tint: '#3B6FE0', bg: '#E3EEFF', value: enquiryItems.length, locked: isGuest, onPress: isGuest ? needLogin : () => navigation.navigate('MyEnquiries') },
    { label: 'Compares', icon: 'swap-horizontal', tint: brand.gold, bg: brand.goldSoft, value: compareHistory.length, onPress: () => navigation.navigate('Compare', { screen: 'CompareMain' }) },
    { label: 'Recent searches', icon: 'time-outline', tint: colors.success, bg: '#E2F5EE', value: searchCount, onPress: () => navigation.navigate('RecentSearches') },
    { label: 'Viewed properties', icon: 'eye-outline', tint: '#C2410C', bg: '#FDEBDD', value: isGuest ? viewCount : (views.data?.total ?? 0), onPress: () => navigation.navigate('ViewedProperties') },
  ];

  const confirmLogout = () =>
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: signOut },
      ]
    );

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}>
      <ScreenHeader title="Dashboard" subtitle={isGuest ? 'Browsing as guest' : `${greeting()}, ${displayName.split(' ')[0]}`} back />
      <View style={{ paddingHorizontal: 20 }}>
        {/* Identity hero */}
        <SpringIn delay={40} from="pop">
          <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Shimmer />
            <View style={styles.heroTop}>
              <View style={styles.avatar}>
                <Ripple />
                {isGuest ? (
                  <Ionicons name="person-outline" size={28} color={colors.white} />
                ) : (
                  <Text style={styles.avatarText}>{initial}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                {displayContact ? <Text style={styles.contact} numberOfLines={1}>{displayContact}</Text> : null}
              </View>
              {!isGuest ? (
                <PressableScale to={0.88} onPress={() => navigation.navigate('Settings')} style={styles.edit} accessibilityLabel="Edit profile">
                  <Ionicons name="create-outline" size={18} color={colors.white} />
                </PressableScale>
              ) : null}
            </View>
            <View style={styles.tags}>
              {isGuest ? <View style={styles.tag}><Text style={styles.tagText}>Guest</Text></View> : null}
              {purpose ? <View style={styles.tag}><Text style={styles.tagText}>{purpose}</Text></View> : null}
              {user?.role && user.role !== 'user' && user.role.toLowerCase() !== (purpose || '').toLowerCase() ? (
                <View style={[styles.tag, { backgroundColor: brand.goldBright }]}>
                  <Text style={[styles.tagText, { color: colors.ink }]}>{roleLabel(user.role)}</Text>
                </View>
              ) : null}
              {user?.city ? (
                <View style={styles.tag}>
                  <Ionicons name="location-outline" size={11} color={colors.white} />
                  <Text style={styles.tagText}>{user.city}</Text>
                </View>
              ) : null}
            </View>
            {isGuest ? (
              <PressableScale onPress={needLogin} to={0.97} style={styles.heroCta} accessibilityRole="button">
                <Text style={styles.heroCtaText}>Sign in or register</Text>
                <Ionicons name="arrow-forward" size={16} color={brand.deep} />
              </PressableScale>
            ) : null}
          </LinearGradient>
        </SpringIn>

        {/* Stats */}
        <View style={styles.grid}>
          {stats.map((s, i) => (
            <SpringIn key={s.label} delay={160 + stagger(i, 70)} from="pop" style={styles.tileWrap}>
              <StatTile {...s} index={i} />
            </SpringIn>
          ))}
        </View>

        {/* My listings: status breakdown plus post / manage (edit, delete) */}
        {!isGuest ? (
          <SpringIn delay={380} style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>My listings</Text>
              {listingItems.length ? (
                <PressableScale onPress={() => navigation.navigate('MyProperties')} hitSlop={8}>
                  <Text style={styles.link}>Manage</Text>
                </PressableScale>
              ) : null}
            </View>
            {listingItems.length ? (
            <>
            <View style={styles.barTrack}>
              <GrowBar>
                {statusCounts.filter((s) => s.count).map((s) => (
                  <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }} />
                ))}
              </GrowBar>
            </View>
            <View style={styles.legend}>
              {statusCounts.map((s) => (
                <View key={s.key} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendText}>{s.label}</Text>
                  <Text style={styles.legendCount}>{s.count}</Text>
                </View>
              ))}
            </View>
            </>
            ) : (
              <Text style={styles.panelEmpty}>You haven't posted a property yet.</Text>
            )}
            <View style={styles.panelActions}>
              <PressableScale onPress={() => navigation.navigate('Post')} to={0.94} style={[styles.panelBtn, styles.panelBtnPrimary]} accessibilityRole="button" accessibilityLabel="Post a new property">
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={[styles.panelBtnText, { color: colors.white }]}>Post new</Text>
              </PressableScale>
              {listingItems.length ? (
                <PressableScale onPress={() => navigation.navigate('MyProperties')} to={0.94} style={styles.panelBtn} accessibilityRole="button" accessibilityLabel="Edit or delete your listings">
                  <Ionicons name="create-outline" size={16} color={colors.goldDeep} />
                  <Text style={styles.panelBtnText}>Edit / delete</Text>
                </PressableScale>
              ) : null}
            </View>
          </SpringIn>
        ) : null}

        {/* Quick actions and activity are about browsing, which developers don't do. */}
        {isDeveloper ? null : (
        <>
        {/* Quick actions */}
        <SpringIn delay={440}>
          <Text style={styles.sec}>Quick actions</Text>
        </SpringIn>
        <View style={styles.actions}>
          {QUICK_ACTIONS.map((a, i) => (
            <SpringIn key={a.label} delay={480 + i * 70} from="pop" style={{ flex: 1 }}>
              <ActionTile label={a.label} icon={a.icon} onPress={() => navigation.navigate(...a.to)} />
            </SpringIn>
          ))}
        </View>

        {/* Recent activity */}
        <SpringIn delay={560}>
          <Text style={styles.sec}>Recent activity</Text>
          <View style={styles.group}>
            {activity.length ? activity.map((a, i) => (
              <SpringIn key={a.id} delay={620 + i * 80} from="right">
              <PressableScale onPress={a.onPress} to={0.97} style={[styles.row, i < activity.length - 1 && styles.border]} accessibilityRole="button">
                <View style={[styles.ic, { backgroundColor: a.bg }]}><Ionicons name={a.icon} size={18} color={a.tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actT} numberOfLines={1}>{a.title}</Text>
                  <Text style={styles.actM} numberOfLines={1}>{a.meta} · {timeAgo(a.at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#B5AFBB" />
              </PressableScale>
              </SpringIn>
            )) : (
              <View style={styles.emptyAct}>
                <Ionicons name="pulse-outline" size={22} color={colors.muted} />
                <Text style={styles.emptyText}>Your enquiries and comparisons will show up here.</Text>
              </View>
            )}
          </View>
        </SpringIn>
        </>
        )}

        <SpringIn delay={680}>
          <Text style={styles.sec}>Account</Text>
          <View style={styles.group}>
            {!isGuest ? (
              <Row icon="log-out-outline" label="Log out" danger onPress={confirmLogout} last />
            ) : (
              <Row icon="log-in-outline" label="Sign in" onPress={needLogin} last />
            )}
          </View>
        </SpringIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 18, ...shadow.float },
  // Clips the shimmer to the card's corners without clipping the card's shadow.
  shineClip: { ...StyleSheet.absoluteFillObject, borderRadius: radius.xl, overflow: 'hidden' },
  shine: { position: 'absolute', top: -60, bottom: -60, width: 90 },
  ripple: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 31, borderWidth: 2, borderColor: colors.white },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  avatarText: { fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', color: colors.white },
  name: { fontSize: 19, fontWeight: '800', color: colors.white },
  contact: { color: 'rgba(255,255,255,0.82)', marginTop: 2, fontSize: 13 },
  edit: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', gap: 6, marginTop: 14, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '800', color: colors.white, textTransform: 'capitalize' },
  heroCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 11, marginTop: 16 },
  heroCtaText: { fontSize: 14, fontWeight: '800', color: brand.deep },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tileWrap: { width: '47.5%' },
  tile: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  tileIc: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileV: { fontFamily: fonts.serif, fontSize: 28, fontWeight: '700', color: colors.ink, marginTop: 10 },
  tileL: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  panel: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, marginTop: 16 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  panelTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  panelEmpty: { fontSize: 13, color: colors.muted },
  panelActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  panelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 12, backgroundColor: colors.champagneSoft },
  panelBtnPrimary: { backgroundColor: colors.goldDeep },
  panelBtnText: { fontSize: 13, fontWeight: '800', color: colors.goldDeep },
  link: { fontSize: 13, fontWeight: '700', color: colors.goldDeep },
  barTrack: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.line },
  bar: { flex: 1, flexDirection: 'row', gap: 2 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  legendCount: { fontSize: 12.5, color: colors.ink, fontWeight: '800' },
  sec: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: colors.muted, textTransform: 'uppercase', marginTop: 26, marginBottom: 10, marginLeft: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  action: { flex: 1, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: colors.line },
  actionIc: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.champagneSoft, alignItems: 'center', justifyContent: 'center' },
  actionL: { fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: 8 },
  group: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ic: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.champagneSoft, alignItems: 'center', justifyContent: 'center' },
  rl: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  actT: { fontSize: 14, fontWeight: '700', color: colors.ink },
  actM: { fontSize: 12, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  emptyAct: { alignItems: 'center', gap: 8, padding: 22 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
