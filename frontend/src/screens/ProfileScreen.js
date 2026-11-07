import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import appJson from '../../app.json';
import Screen from '../components/Screen';
import GlassView from '../components/GlassView';
import PressableScale from '../components/PressableScale';
import CountUp from '../components/CountUp';
import { isReducedMotion } from '../hooks/useReducedMotion';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { getCompareHistory, subscribeCompareHistory } from '../services/historyService';
import { PURPOSES } from './RoleScreen';
import { formatPhone, roleLabel } from '../utils/format';
import { brand, colors, gradients, radius, shadow, type } from '../theme';
import Text from '../components/AppText';

// Roles the app itself uses. Staff roles (admin, superadmin) belong to the separate CRM, so the
// profile never shows them, even on accounts promoted before phone-based promotion was removed.
const APP_ROLES = ['broker', 'developer'];

const AVATAR = 104;

// Springy entrance: "up" rises into place, "pop" scales up from small. Settles with a small overshoot.
function SpringIn({ delay = 0, from = 'up', style, children }) {
  const reduced = isReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(v, { toValue: 1, delay, speed: 9, bounciness: 8, useNativeDriver: true }).start();
  }, [v, delay, reduced]);
  const opacity = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const transform = from === 'pop'
    ? [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]
    : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }];
  return <Animated.View style={[style, { opacity, transform }]}>{children}</Animated.View>;
}

// Soft light band that sweeps across the avatar on load, then again every few seconds.
function Shine() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isReducedMotion()) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(3400),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={styles.shineClip} pointerEvents="none">
      <Animated.View
        style={[styles.shine, {
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-AVATAR, AVATAR] }) }, { rotate: '20deg' }],
        }]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function Stat({ label, value, locked, onPress }) {
  return (
    <PressableScale
      onPress={onPress}
      to={0.94}
      style={styles.stat}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${locked ? 'sign in to view' : value}`}
    >
      {locked ? (
        <Ionicons name="lock-closed-outline" size={20} color={colors.muted} style={styles.statLock} />
      ) : (
        <CountUp value={value} style={styles.statV} />
      )}
      <Text style={styles.statL} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

function MenuRow({ icon, label, onPress, danger, last }) {
  return (
    <PressableScale onPress={onPress} to={0.98} style={[styles.row, !last && styles.rowBorder]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.rowIc, danger && { backgroundColor: brand.errorSoft }]}>
        <Ionicons name={icon} size={19} color={danger ? colors.error : brand.violet} />
      </View>
      <Text style={[styles.rowL, danger && { color: colors.error }]}>{label}</Text>
      {danger ? null : <Ionicons name="chevron-forward" size={18} color={brand.placeholder} />}
    </PressableScale>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, token, isDeveloper, signOut } = useAuth();
  const saved = useSaved();
  const toast = useToast();
  const isGuest = !token;
  const buyer = !isGuest && !isDeveloper;
  const purpose = PURPOSES.find((p) => p.key === user?.purpose)?.label;
  const displayName = user?.name || user?.fullName || (isGuest ? 'Guest User' : 'Verified User');
  const displayContact = user?.email || (user?.phone ? formatPhone(user.phone) : (isGuest ? 'Browsing mode' : ''));
  const initial = displayName.charAt(0).toUpperCase();
  // Badge beside the name: an app role (broker / developer) wins over the self-picked purpose.
  const badge = isGuest ? 'Guest'
    : APP_ROLES.includes(user?.role) ? roleLabel(user.role)
      : purpose || null;

  // Account-only data; skipped for guests so the sign-in dialog doesn't pop up on a 401.
  const listings = useApi(() => api.myProperties(), [token], { enabled: !isGuest });
  // Developers don't browse, so they have no enquiries of their own.
  const enquiries = useApi(() => api.myEnquiries(), [token], { enabled: buyer });
  const [compareCount, setCompareCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getCompareHistory().then((list) => setCompareCount(list.length));
    return subscribeCompareHistory((list) => setCompareCount(list.length));
  }, []);

  useEffect(() => navigation.addListener('focus', () => {
    if (!isGuest) listings.refresh();
    if (buyer) enquiries.refresh();
  }), [navigation, isGuest, buyer]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([...(isGuest ? [] : [listings.refresh()]), ...(buyer ? [enquiries.refresh()] : [])]);
    setRefreshing(false);
  };

  const listingItems = listings.data?.items || [];
  const enquiryCount = (enquiries.data?.items || []).length;
  const countStatus = (key) => listingItems.filter((p) => (p.approvalStatus || 'approved') === key).length;

  const needLogin = () => navigation.navigate('Login');
  const manage = () => navigation.navigate('MyProperties');

  const stats = isDeveloper ? [
    { label: 'Listings', value: listingItems.length, onPress: manage },
    { label: 'Live', value: countStatus('approved'), onPress: manage },
    { label: 'Pending', value: countStatus('pending'), onPress: manage },
  ] : [
    { label: 'Saved', value: saved.count, onPress: () => navigation.navigate('Saved') },
    { label: 'Compares', value: compareCount, onPress: () => navigation.navigate('Compare', { screen: 'CompareMain' }) },
    { label: 'Enquiries', value: enquiryCount, locked: isGuest, onPress: isGuest ? needLogin : () => navigation.navigate('MyEnquiries') },
  ];

  // Push the form onto this tab's own stack (not the Post tab) so its back button returns here;
  // switching tabs would make back fall through to the first tab (Home).
  const postProperty = () => navigation.push('PostPropertyForm');
  const banner = isGuest
    ? { icon: 'person-circle', title: 'You\'re browsing as a guest', sub: 'Sign in to save, enquire and post.', cta: 'Sign in', onPress: needLogin }
    : isDeveloper
      ? { icon: 'business', title: 'Launch a new project', sub: 'Reach buyers searching in your city.', cta: 'Post', onPress: postProperty }
      : { icon: 'star', title: 'Have a property to sell?', sub: 'List it free and reach serious buyers.', cta: 'Post', onPress: postProperty };

  const menu = [
    !isGuest && { icon: 'person-circle-outline', label: 'Edit profile', onPress: () => navigation.navigate('Settings') },
    !isGuest && { icon: 'home-outline', label: 'My listings', onPress: manage },
    buyer && { icon: 'chatbubble-ellipses-outline', label: 'My enquiries', onPress: () => navigation.navigate('MyEnquiries') },
    !isDeveloper && { icon: 'heart-outline', label: 'Saved properties', onPress: () => navigation.navigate('Saved') },
    !isDeveloper && { icon: 'time-outline', label: 'Recent searches', onPress: () => navigation.navigate('RecentSearches') },
    isGuest
      ? { icon: 'log-in-outline', label: 'Sign in', onPress: needLogin }
      : { icon: 'log-out-outline', label: 'Log out', danger: true, onPress: () => confirmLogout() },
  ].filter(Boolean);

  const confirmLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);

  const checkServer = async () => {
    try { await api.health(); toast.show('Server is reachable', 'success'); } catch (e) { toast.show(e.message, 'error'); }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}>
      <View style={styles.page}>
        {/* Title + notifications */}
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Profile</Text>
          <PressableScale onPress={() => navigation.navigate('Notification')} to={0.9} hitSlop={6} accessibilityRole="button" accessibilityLabel="Notifications">
            <GlassView level="strong" borderRadius={23} style={styles.bell}>
              <Ionicons name="notifications-outline" size={21} color={brand.violet} />
            </GlassView>
          </PressableScale>
        </View>

        {/* Avatar, sitting over the top edge of the identity card */}
        <SpringIn from="pop" delay={40} style={styles.avatarWrap}>
          <View style={styles.halo}>
            <LinearGradient colors={gradients.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              {isGuest ? (
                <Ionicons name="person" size={42} color={colors.white} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
              <Shine />
            </LinearGradient>
          </View>
        </SpringIn>

        {/* Identity card */}
        <SpringIn delay={120} style={[styles.card, styles.idCard]}>
          <View style={styles.idRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              {displayContact ? <Text style={styles.contact} numberOfLines={1}>{displayContact}</Text> : null}
              {user?.city ? (
                <View style={styles.cityRow}>
                  <Ionicons name="location-outline" size={12} color={colors.muted} />
                  <Text style={styles.contact}>{user.city}</Text>
                </View>
              ) : null}
            </View>
            {badge ? (
              <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                <Ionicons name={isDeveloper ? 'business' : isGuest ? 'eye-outline' : 'ribbon'} size={13} color={colors.white} />
                <Text style={styles.badgeText}>{badge}</Text>
              </LinearGradient>
            ) : null}
          </View>

          <View style={styles.stats}>
            {stats.map((s) => <Stat key={s.label} {...s} />)}
          </View>

          <PressableScale onPress={banner.onPress} to={0.98} accessibilityRole="button" accessibilityLabel={`${banner.title}. ${banner.cta}`}>
            <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <Ionicons name={banner.icon} size={22} color={colors.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerT} numberOfLines={1}>{banner.title}</Text>
                <Text style={styles.bannerS} numberOfLines={1}>{banner.sub}</Text>
              </View>
              <View style={styles.bannerBtn}><Text style={styles.bannerBtnText}>{banner.cta}</Text></View>
            </LinearGradient>
          </PressableScale>
        </SpringIn>

        {/* Menu */}
        <SpringIn delay={220} style={[styles.card, styles.menu]}>
          {menu.map((m, i) => <MenuRow key={m.label} {...m} last={i === menu.length - 1} />)}
        </SpringIn>

        <PressableScale onPress={checkServer} hitSlop={8} style={styles.footer} accessibilityRole="button" accessibilityLabel="Check server connection">
          <Text style={styles.footerText}>Version {appJson.expo.version} · Check connection</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.display, fontSize: 32 },
  bell: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', ...shadow.glass },

  // zIndex for iOS/web; Android stacks siblings by elevation, so it must beat the card's.
  avatarWrap: { alignItems: 'center', marginTop: 4, marginBottom: -AVATAR / 2 + 6, zIndex: 2, elevation: 8 },
  halo: {
    width: AVATAR + 20, height: AVATAR + 20, borderRadius: (AVATAR + 20) / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(124,44,245,0.10)',
  },
  // Clips the shine to the avatar circle (inside its white border) without clipping the avatar's shadow.
  shineClip: { ...StyleSheet.absoluteFillObject, borderRadius: AVATAR / 2, overflow: 'hidden' },
  shine: { position: 'absolute', top: -AVATAR / 2, bottom: -AVATAR / 2, width: AVATAR * 0.45 },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.white, ...shadow.card,
  },
  avatarText: { fontSize: 40, fontWeight: '800', color: colors.white },

  card: { backgroundColor: colors.white, borderRadius: 28, ...shadow.glass },
  idCard: { paddingTop: AVATAR / 2 + 8, paddingHorizontal: 16, paddingBottom: 16 },
  idRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  contact: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 2,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.white, textTransform: 'capitalize' },

  stats: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: brand.lavender, borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: colors.line },
  statV: { fontSize: 24, fontWeight: '800', color: brand.deep },
  statLock: { marginVertical: 5 },
  statL: { fontSize: 12, color: colors.muted, marginTop: 2 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, marginTop: 12 },
  bannerT: { fontSize: 13.5, fontWeight: '800', color: colors.white },
  bannerS: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  bannerBtn: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  bannerBtnText: { fontSize: 13, fontWeight: '800', color: brand.deep },

  menu: { marginTop: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIc: { width: 36, height: 36, borderRadius: 12, backgroundColor: brand.lavender, alignItems: 'center', justifyContent: 'center' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowL: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },

  footer: { alignSelf: 'center', marginTop: 18 },
  footerText: { fontSize: 12, color: colors.muted },
});
