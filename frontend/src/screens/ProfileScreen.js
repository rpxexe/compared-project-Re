import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import { useAuth } from '../context/AuthContext';
import { useSaved } from '../context/SavedContext';
import { PURPOSES } from './RoleScreen';
import { formatPhone } from '../utils/format';
import { colors, fonts, glowSubtle, radius, shadow } from '../theme';

function Row({ icon, label, value, onPress, danger, last }) {
  return (
    <PressableScale onPress={onPress} to={0.97} style={[styles.row, !last && styles.border]} accessibilityRole="button">
      <View style={[styles.ic, danger && { backgroundColor: '#F6E3E3' }]}><Ionicons name={icon} size={19} color={danger ? colors.error : colors.goldDeep} /></View>
      <Text style={[styles.rl, danger && { color: colors.error }]}>{label}</Text>
      {value ? <Text style={styles.rv}>{value}</Text> : null}
      {!danger ? <Ionicons name="chevron-forward" size={18} color="#B5AFBB" /> : null}
    </PressableScale>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, token, signOut, isStaff } = useAuth();
  const saved = useSaved();
  const isGuest = !token;
  const purpose = PURPOSES.find((p) => p.key === user?.purpose)?.label;
  const displayName = user?.name || user?.fullName || (isGuest ? 'Guest User' : 'Verified User');
  const displayContact = user?.email || (user?.phone ? formatPhone(user.phone) : (isGuest ? 'Browsing Mode' : ''));
  const initial = displayName.charAt(0).toUpperCase();

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
    <Screen>
      <ScreenHeader title="Profile" back />
      <View style={{ paddingHorizontal: 20 }}>
        <View style={styles.card}>
          {/* Frosted Glass Layers */}
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.94)', 'rgba(246, 242, 255, 0.85)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
            pointerEvents="none"
          />

          <View style={styles.avatar}>
            {isGuest ? (
              <Ionicons name="person-outline" size={30} color={colors.gold} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <View style={{ flex: 1, zIndex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.phone}>{displayContact}</Text>
            <View style={styles.tags}>
              {isGuest ? (
                <View style={[styles.tag, { backgroundColor: colors.lavender }]}>
                  <Text style={[styles.tagText, { color: colors.goldDeep }]}>Guest</Text>
                </View>
              ) : null}
              {purpose ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{purpose}</Text>
                </View>
              ) : null}
              {user?.role && user.role !== 'user' ? (
                <View style={[styles.tag, { backgroundColor: colors.ink }]}>
                  <Text style={[styles.tagText, { color: colors.gold }]}>
                    {user.role}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {!isGuest ? (
            <PressableScale
              to={0.88}
              onPress={() => navigation.navigate('Settings')}
              style={styles.edit}
              accessibilityLabel="Edit profile"
            >
              <Ionicons name="create-outline" size={18} color={colors.ink} />
            </PressableScale>
          ) : null}
        </View>

        {isGuest ? (
          <View style={{ marginTop: 16 }}>
            <PressableScale
              onPress={() => navigation.navigate('Login')}
              style={styles.signInCard}
            >
              <View style={styles.signInCardContent}>
                <Ionicons name="log-in-outline" size={24} color={colors.goldDeep} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.signInTitle}>Sign In or Register</Text>
                  <Text style={styles.signInSubtitle}>
                    Post properties, enquire with developers & save favorites
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.goldDeep} />
              </View>
            </PressableScale>
          </View>
        ) : null}

        <Text style={styles.sec}>My activity</Text>
        <View style={styles.group}>
          <Row
            icon="heart-outline"
            label="Saved properties"
            value={saved.count ? String(saved.count) : ''}
            onPress={() => navigation.navigate('Saved')}
          />
          <Row
            icon="home-outline"
            label="My posted properties"
            onPress={() => navigation.navigate('MyProperties')}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            label="My enquiries"
            onPress={() => navigation.navigate('MyEnquiries')}
            last
          />
        </View>

        {isStaff ? (
          <>
            <Text style={styles.sec}>Administration</Text>
            <View style={styles.group}>
              <Row
                icon="shield-checkmark-outline"
                label="Admin dashboard"
                onPress={() => navigation.navigate('AdminDashboard')}
                last
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sec}>Account</Text>
        <View style={styles.group}>
          <Row
            icon="settings-outline"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
          />
          {!isGuest ? (
            <Row
              icon="log-out-outline"
              label="Log out"
              danger
              onPress={confirmLogout}
              last
            />
          ) : (
            <Row
              icon="log-in-outline"
              label="Sign in"
              onPress={() => navigation.navigate('Login')}
              last
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.gold },
  avatarText: { fontFamily: fonts.serif, fontSize: 26, color: colors.gold },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink },
  phone: { color: colors.muted, marginTop: 2, fontSize: 13.5 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tag: { backgroundColor: colors.champagneSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '800', color: colors.ink, textTransform: 'capitalize' },
  edit: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  sec: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: colors.muted, textTransform: 'uppercase', marginTop: 26, marginBottom: 10, marginLeft: 4 },
  group: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ic: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.champagneSoft, alignItems: 'center', justifyContent: 'center' },
  rl: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  rv: { color: colors.muted, fontWeight: '700' },
  signInCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.gold,
    padding: 16,
    ...shadow.card,
  },
  signInCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  signInSubtitle: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
});
