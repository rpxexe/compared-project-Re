import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import appJson from '../../app.json';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import Input from '../components/Input';
import Button from '../components/Button';
import FilterChip from '../components/FilterChip';
import { PURPOSES } from './RoleScreen';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLocationAccess } from '../context/LocationAccessContext';
import { api, API_URL } from '../services/api';
import { formatPhone } from '../utils/format';
import { getCurrentUserLocation } from '../services/locationService';
import { colors, radius } from '../theme';
import Text from "../components/AppText";

export default function SettingsScreen() {
  const { ensureLocation } = useLocationAccess();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [purpose, setPurpose] = useState(user?.purpose || '');
  const [saving, setSaving] = useState(false);
  const [locatingCity, setLocatingCity] = useState(false);
  const dirty = name.trim() !== (user?.name || '') || city.trim() !== (user?.city || '') || purpose !== (user?.purpose || '');

  const detectCity = async () => {
    if (!(await ensureLocation("Allow location to detect your city."))) return;
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
      const patch = { name: name.trim(), city: city.trim() };
      if (purpose && purpose !== user.purpose) patch.purpose = purpose;
      const { user: u } = await api.updateMe(patch);
      await updateUser(u);
      toast.show('Profile updated', 'success');
    } catch (e) { toast.show(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <Screen keyboard>
      <ScreenHeader title="Settings" back />
      <View style={{ paddingHorizontal: 20 }}>
        <Input label="MOBILE NUMBER" value={formatPhone(user?.phone)} editable={false} hint="Your login number cannot be changed." />
        <Input label="NAME" value={name} onChangeText={setName} placeholder="Your name" maxLength={80} autoCapitalize="words" style={{ marginTop: 16 }} />
        <Input label="CITY" value={city} onChangeText={setCity} placeholder="Your city" maxLength={80} autoCapitalize="words" style={{ marginTop: 16 }} />
        <Pressable onPress={detectCity} disabled={locatingCity} style={styles.detectBtn}>
          {locatingCity ? (
            <ActivityIndicator size={12} color={colors.goldDeep} />
          ) : (
            <Ionicons name="navigate-outline" size={13} color={colors.goldDeep} />
          )}
          <Text style={styles.detectText}>
            {locatingCity ? 'Detecting...' : 'Use current location'}
          </Text>
        </Pressable>
        <Text style={styles.lbl}>I AM A</Text>
        <View style={styles.wrap}>{PURPOSES.map((p) => <FilterChip key={p.key} label={p.label} active={purpose === p.key} onPress={() => setPurpose(p.key)} />)}</View>
        <Button title="Save changes" onPress={save} loading={saving} disabled={!dirty} style={{ marginTop: 24 }} />

        <View style={styles.about}>
          <Text style={styles.aboutT}>About</Text>
          <Text style={styles.aboutL}>Version {appJson.expo.version}</Text>
          <Text style={styles.aboutL} numberOfLines={1}>Server: {API_URL || 'not configured'}</Text>
          <Button title="Check server connection" variant="ghost" small style={{ marginTop: 12 }} onPress={async () => { try { await api.health(); toast.show('Server is reachable', 'success'); } catch (e) { toast.show(e.message, 'error'); } }} />
        </View>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  lbl: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 20, marginBottom: 10, letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  about: { marginTop: 34, backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line },
  aboutT: { fontWeight: '800', fontSize: 15, color: colors.ink, marginBottom: 6 },
  aboutL: { color: colors.muted, fontSize: 13, marginTop: 3 },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.champagneSoft,
  },
  detectText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.goldDeep,
  },
});
