import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import PressableScale from '../components/PressableScale';
import FilterChip from '../components/FilterChip';
import Button from '../components/Button';
import SearchBar from '../components/SearchBar';
import { Cover } from '../components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatPhone, timeAgo } from '../utils/format';
import { colors, fonts, radius, shadow } from '../theme';
import Text from "../components/AppText";

// Security note: these screens are only reachable for admin/superadmin, but the real protection
// is server-side – every /api/admin/* request is verified against the JWT and the role in MongoDB.

export function AdminDashboard({ navigation }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.admin.stats(), []);
  const tiles = data ? [
    ['Users', data.users, 'people-outline', 'AdminUsers'], ['Properties', data.properties, 'business-outline', 'AdminProperties'],
    ['Pending approval', data.pendingApprovals, 'time-outline', 'AdminProperties', { approval: 'pending' }], ['Posted in app', data.manualProperties, 'document-text-outline', 'AdminProperties', { approval: '', source: 'manual' }],
    ['Enquiries', data.enquiries, 'chatbubble-ellipses-outline', 'AdminEnquiries'], ['New enquiries', data.newEnquiries, 'sparkles-outline', 'AdminEnquiries', { status: 'new' }],
  ] : [];
  return (
    <Screen>
      <ScreenHeader title="Admin" subtitle={`Signed in as ${user?.role}`} back />
      <View style={{ paddingHorizontal: 20 }}>
        {loading && !data ? <LoadingState rows={3} /> : error ? <ErrorState title="Unable to load dashboard" error={error} onRetry={reload} /> : (
          <>
            <View style={styles.grid}>
              {tiles.map(([l, v, ic, to, params]) => (
                <PressableScale key={l} onPress={() => navigation.navigate(to, params)} style={styles.tile}>
                  <Ionicons name={ic} size={22} color={colors.goldDeep} />
                  <Text style={styles.tileV}>{v}</Text><Text style={styles.tileL}>{l}</Text>
                </PressableScale>
              ))}
            </View>
            <Text style={styles.note}>{data.reviews} rating{data.reviews === 1 ? '' : 's'} submitted by users.</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

export function AdminProperties({ route }) {
  const toast = useToast();
  const [approval, setApproval] = useState(route.params?.approval ?? 'pending');
  const [source] = useState(route.params?.source || '');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const { data, loading, error, reload, refresh } = useApi(() => api.admin.properties({ approvalStatus: approval, dataSource: source, search: q.trim(), limit: 30 }), [approval, source, q]);

  const act = async (id, body, msg) => {
    setBusy(id);
    try { await api.admin.reviewProperty(id, body); toast.show(msg, 'success'); await refresh(); } catch (e) { toast.show(e.message, 'error'); } finally { setBusy(''); }
  };
  return (
    <Screen>
      <ScreenHeader title="Properties" subtitle={data ? `${data.total} found` : ' '} back />
      <View style={{ paddingHorizontal: 20 }}><SearchBar value={q} onChangeText={setQ} onSubmit={() => {}} placeholder="Search properties" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 14 }}>
        {[['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, l]) => <FilterChip key={k} label={l} active={approval === k} onPress={() => setApproval(k)} />)}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {loading && !data ? <LoadingState rows={3} /> : error && !data ? <ErrorState title="Unable to load properties" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Cover uri={p.image} style={styles.thumb} iconSize={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cT} numberOfLines={2}>{p.title}</Text>
                  <Text style={styles.cS} numberOfLines={1}>{[p.locality, p.city].filter(Boolean).join(', ') || '—'}</Text>
                  <Text style={styles.cS}>{p.price || 'No price'}{p.dataSource ? ` · ${p.dataSource}` : ''}{p.approvalStatus ? ` · ${p.approvalStatus}` : ''}</Text>
                  {p.contactPhone ? <Text style={styles.cS}>{formatPhone(p.contactPhone)}</Text> : null}
                </View>
              </View>
              <View style={styles.btns}>
                {p.approvalStatus !== 'approved' && p.dataSource === 'manual' ? <Button small title="Approve" icon="checkmark" style={{ flex: 1 }} loading={busy === p.id} onPress={() => act(p.id, { approvalStatus: 'approved' }, 'Approved')} /> : null}
                {p.approvalStatus !== 'rejected' && p.dataSource === 'manual' ? <Button small title="Reject" variant="ghost" style={{ flex: 1 }} disabled={busy === p.id} onPress={() => act(p.id, { approvalStatus: 'rejected', rejectionReason: 'Does not meet listing guidelines' }, 'Rejected')} /> : null}
                <Button small variant="ghost" title={p.featured ? 'Unfeature' : 'Feature'} style={{ flex: 1 }} disabled={busy === p.id} onPress={() => act(p.id, { featured: !p.featured }, p.featured ? 'Removed from featured' : 'Marked featured')} />
              </View>
            </View>
          )) : <EmptyState icon="business-outline" title="No properties found" message="Nothing matches this filter." />}
      </View>
    </Screen>
  );
}

export function AdminEnquiries({ route }) {
  const toast = useToast();
  const [status, setStatus] = useState(route.params?.status || '');
  const { data, loading, error, reload, refresh } = useApi(() => api.admin.enquiries({ status, limit: 40 }), [status]);
  const set = async (id, s) => { try { await api.admin.updateEnquiry(id, s); await refresh(); } catch (e) { toast.show(e.message, 'error'); } };
  return (
    <Screen>
      <ScreenHeader title="Enquiries" subtitle={data ? `${data.total} found` : ' '} back />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}>
        {[['', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']].map(([k, l]) => <FilterChip key={k} label={l} active={status === k} onPress={() => setStatus(k)} />)}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {loading && !data ? <LoadingState rows={3} /> : error && !data ? <ErrorState title="Unable to load enquiries" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((e) => (
            <View key={e.id} style={styles.card}>
              <Text style={styles.cT} numberOfLines={2}>{e.propertyTitle || 'Property'}</Text>
              <Text style={styles.cS}>{e.name ? `${e.name} · ` : ''}{formatPhone(e.phone)} · {timeAgo(e.createdAt)}</Text>
              {e.message ? <Text style={styles.msg}>{e.message}</Text> : null}
              <View style={styles.btns}>{['new', 'contacted', 'closed'].map((s) => <FilterChip key={s} label={s} active={e.status === s} onPress={() => e.status !== s && set(e.id, s)} />)}</View>
            </View>
          )) : <EmptyState icon="chatbubble-ellipses-outline" title="No enquiries" message="Enquiries from the app will show up here." />}
      </View>
    </Screen>
  );
}

export function AdminUsers() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi(() => api.admin.users({ search: q.trim(), limit: 40 }), [q]);
  return (
    <Screen>
      <ScreenHeader title="Users" subtitle={data ? `${data.total} total` : ' '} back />
      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}><SearchBar value={q} onChangeText={setQ} onSubmit={() => {}} placeholder="Search by name or number" /></View>
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {loading && !data ? <LoadingState rows={4} /> : error && !data ? <ErrorState title="Unable to load users" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((u) => (
            <View key={u.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={styles.av}><Text style={styles.avT}>{(u.name || u.phone).charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.cT}>{u.name || formatPhone(u.phone)}</Text><Text style={styles.cS}>{u.name ? `${formatPhone(u.phone)} · ` : ''}{u.purpose || 'no purpose'}</Text></View>
              <View style={styles.role}><Text style={styles.roleT}>{u.role}</Text></View>
            </View>
          )) : <EmptyState icon="people-outline" title="No users found" />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  tileV: { fontFamily: fonts.serif, fontSize: 32, color: colors.ink, marginTop: 10 },
  tileL: { fontSize: 12.5, color: colors.muted, fontWeight: '600' },
  note: { textAlign: 'center', color: colors.muted, marginTop: 18, fontSize: 12.5 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 70, height: 70, borderRadius: 14, overflow: 'hidden' },
  cT: { fontWeight: '800', color: colors.ink, fontSize: 14.5 },
  cS: { fontSize: 12.5, color: colors.muted, marginTop: 3 },
  msg: { marginTop: 8, color: colors.text, fontSize: 13.5, lineHeight: 20 },
  btns: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.champagneSoft, alignItems: 'center', justifyContent: 'center' },
  avT: { fontWeight: '800', color: colors.goldDeep },
  role: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  roleT: { color: colors.gold, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
});
