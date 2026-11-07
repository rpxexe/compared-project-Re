import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Screen from '../components/Screen';
import Input from '../components/Input';
import Button from '../components/Button';
import GlassView from '../components/GlassView';
import PressableScale from '../components/PressableScale';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLocationAccess } from '../context/LocationAccessContext';
import { api } from '../services/api';
import { formatPhone } from '../utils/format';
import { getCurrentUserLocation } from '../services/locationService';
import { brand, colors, gradients, radius, shadow } from '../theme';
import Text from '../components/AppText';

// Edit profile. Route name stays "Settings" so existing navigate('Settings') calls keep working.
export default function SettingsScreen() {
  const nav = useNavigation();
  const { ensureLocation } = useLocationAccess();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [saving, setSaving] = useState(false);
  const [locatingCity, setLocatingCity] = useState(false);
  const dirty = name.trim() !== (user?.name || '') || city.trim() !== (user?.city || '');
  const initial = (name.trim() || user?.name || 'U').charAt(0).toUpperCase();

  const detectCity = async () => {
    if (!(await ensureLocation('Allow location to detect your city.'))) return;
    setLocatingCity(true);
    try {
      const res = await getCurrentUserLocation();
      if (res && res.city) {
        setCity(res.city);
        toast.show(`Detected city: ${res.city}`);
      }
    } catch (e) {
      toast.show(e?.message || 'Failed to detect location', 'error');
    } finally {
      setLocatingCity(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { user: u } = await api.updateMe({ name: name.trim(), city: city.trim() });
      await updateUser(u);
      toast.show('Profile updated', 'success');
    } catch (e) { toast.show(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <Screen keyboard scroll={false}>
      {/* Back · centred title · spacer */}
      <View style={styles.header}>
        <PressableScale onPress={() => nav.goBack()} to={0.9} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <GlassView level="regular" blur borderRadius={22} style={styles.back}>
            <Ionicons name="arrow-back" size={21} color={brand.violet} />
          </GlassView>
        </PressableScale>
        <Text style={styles.title} accessibilityRole="header">Edit Profile</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Reveal delay={40} style={styles.avatarWrap}>
          <LinearGradient colors={gradients.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
        </Reveal>

        <Reveal delay={90}>
          <Text style={styles.section}>Basic detail</Text>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" maxLength={80} autoCapitalize="words" />
        </Reveal>

        <Reveal delay={140}>
          <Text style={styles.section}>Contact detail</Text>
          <Input
            label="Mobile number"
            value={formatPhone(user?.phone)}
            editable={false}
            hint="Your login number cannot be changed."
            inputStyle={{ color: colors.muted }}
          />
        </Reveal>

        <Reveal delay={190}>
          <Text style={styles.section}>Location</Text>
          <Input label="City" value={city} onChangeText={setCity} placeholder="Your city" maxLength={80} autoCapitalize="words" />
          <Pressable onPress={detectCity} disabled={locatingCity} style={styles.detectBtn} accessibilityRole="button">
            {locatingCity ? (
              <ActivityIndicator size={12} color={colors.goldDeep} />
            ) : (
              <Ionicons name="navigate-outline" size={13} color={colors.goldDeep} />
            )}
            <Text style={styles.detectText}>{locatingCity ? 'Detecting...' : 'Use current location'}</Text>
          </Pressable>
        </Reveal>
      </ScrollView>

      {/* Save stays pinned above the tab bar */}
      <View style={styles.footer}>
        <Button title="Save" onPress={save} loading={saving} disabled={!dirty} />
      </View>
    </Screen>
  );
}

const AVATAR = 92;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  body: { paddingHorizontal: 20, paddingBottom: 24 },

  avatarWrap: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.white, ...shadow.card,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.white },

  section: { fontSize: 16, fontWeight: '800', color: brand.deep, marginTop: 24, marginBottom: 12 },

  detectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.champagneSoft,
  },
  detectText: { fontSize: 12, fontWeight: '700', color: colors.goldDeep },

  footer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow.glass,
  },
});
