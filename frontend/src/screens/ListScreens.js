import React from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import { badgeFor } from '../components/PropertyCard';
import ListingCard, { ListingCardSkeleton, ListingSkeletonList } from '../components/search/ListingCard';
import Reveal, { stagger } from '../components/Reveal';
import { EmptyState, ErrorState, Skeleton, SkeletonText } from '../components/StateViews';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { smoothLayout } from '../components/compare/CompareTable';
import PressableScale from '../components/PressableScale';
import { clearSearchHistory, getSearchHistory } from '../services/historyService';
import { timeAgo } from '../utils/format';
import { colors, radius } from '../theme';
import Text from "../components/AppText";

const STATUS = { pending: ['Pending review', '#6D28D9', '#EBE2FF'], approved: ['Live', '#3F7D5C', '#E4F1E9'], rejected: ['Rejected', '#C96B6B', '#F6E3E3'] };

export function SavedScreen({ navigation }) {
  const { data, loading, error, reload, refresh } = useApi(() => api.saved(), []);
  const [r, setR] = React.useState(false);
  React.useEffect(() => navigation.addListener('focus', () => refresh()), [navigation]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen refreshControl={<RefreshControl refreshing={r} onRefresh={async () => { setR(true); await refresh(); setR(false); }} tintColor={colors.gold} />}>
      <ScreenHeader title="Saved properties" back />
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {loading && !data ? <ListingSkeletonList rows={3} gap={14} /> : error && !data ? <ErrorState title="Unable to load saved properties" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((p, i) => <ListingCard key={p.id} property={p} index={i} tag={badgeFor(p)} />)
            : <EmptyState icon="heart-outline" title="No saved properties yet" message="Tap the heart on any property to keep it here." action="Explore properties" onAction={() => navigation.navigate('Search')} />}
      </View>
    </Screen>
  );
}

// Matches a My listings item: status pill, the card, then the Edit / Delete row.
function MyListingSkeletons({ rows = 3 }) {
  return (
    <View style={{ gap: 14 }} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i}>
          <Skeleton style={{ width: 92, height: 28, borderRadius: radius.pill, marginBottom: 8 }} />
          <ListingCardSkeleton />
          <View style={styles.crud}>
            <Skeleton style={{ flex: 1, height: 40, borderRadius: 12 }} />
            <Skeleton style={{ flex: 1, height: 40, borderRadius: 12 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// The user's own listings with full CRUD: post a new one, open (read), edit, delete.
export function MyPropertiesScreen({ navigation }) {
  const toast = useToast();
  const { data, loading, error, reload, refresh } = useApi(() => api.myProperties(), []);
  const [removed, setRemoved] = React.useState(() => new Set()); // hidden instantly while the delete runs
  const [r, setR] = React.useState(false);
  React.useEffect(() => navigation.addListener('focus', () => refresh()), [navigation]); // eslint-disable-line react-hooks/exhaustive-deps
  const post = () => navigation.navigate('Tabs', { screen: 'Post' });

  const confirmDelete = (p) =>
    Alert.alert('Delete property?', `"${p.title}" will be removed permanently. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          smoothLayout();
          setRemoved((s) => new Set(s).add(p.id));
          try {
            await api.deleteMyProperty(p.id);
            toast.show('Property deleted', 'success');
            refresh();
          } catch (e) {
            smoothLayout();
            setRemoved((s) => { const n = new Set(s); n.delete(p.id); return n; });
            toast.show(e.message, 'error');
          }
        },
      },
    ]);

  const items = (data?.items || []).filter((p) => !removed.has(p.id));
  return (
    <Screen refreshControl={<RefreshControl refreshing={r} onRefresh={async () => { setR(true); await refresh(); setR(false); }} tintColor={colors.gold} />}>
      <ScreenHeader
        title="My properties"
        subtitle={items.length ? `${items.length} listing${items.length === 1 ? '' : 's'}` : ' '}
        back
        right={
          <PressableScale onPress={post} to={0.92} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Post a new property">
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addText}>Post</Text>
          </PressableScale>
        }
      />
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {loading && !data ? <MyListingSkeletons /> : error && !data ? <ErrorState title="Unable to load your properties" error={error} onRetry={reload} />
          : items.length ? items.map((p, i) => {
            const s = STATUS[p.approvalStatus] || STATUS.approved;
            return (
              <Reveal key={p.id} delay={stagger(i, 70, 6)}>
                <View style={[styles.status, { backgroundColor: s[2] }]}><Text style={[styles.statusText, { color: s[1] }]}>{s[0]}</Text>{p.rejectionReason ? <Text style={styles.reason}> · {p.rejectionReason}</Text> : null}</View>
                <ListingCard property={p} index={i} tag={badgeFor(p)} />
                <View style={styles.crud}>
                  <PressableScale onPress={() => navigation.navigate('PostPropertyForm', { editId: p.id })} to={0.94} style={[styles.crudBtn, styles.crudEdit]} accessibilityRole="button" accessibilityLabel={`Edit ${p.title}`}>
                    <Ionicons name="create-outline" size={16} color={colors.goldDeep} />
                    <Text style={[styles.crudText, { color: colors.goldDeep }]}>Edit</Text>
                  </PressableScale>
                  <PressableScale onPress={() => confirmDelete(p)} to={0.94} style={[styles.crudBtn, styles.crudDelete]} accessibilityRole="button" accessibilityLabel={`Delete ${p.title}`}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={[styles.crudText, { color: colors.error }]}>Delete</Text>
                  </PressableScale>
                </View>
              </Reveal>
            );
          })
            : <EmptyState icon="home-outline" title="You haven't posted any property" message="Listings you post will appear here with their review status." action="Post a property" onAction={post} />}
      </View>
    </Screen>
  );
}

export function MyEnquiriesScreen({ navigation }) {
  const { data, loading, error, reload } = useApi(() => api.myEnquiries(), []);
  return (
    <Screen>
      <ScreenHeader title="My enquiries" back />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {loading && !data ? <EnquirySkeletons /> : error && !data ? <ErrorState title="Unable to load enquiries" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((e, i) => (
            <Reveal key={e.id} delay={stagger(i, 70, 6)} style={styles.enq}>
              <Text style={styles.enqTitle} numberOfLines={2}>{e.propertyTitle || 'Property'}</Text>
              {e.message ? <Text style={styles.enqMsg} numberOfLines={3}>{e.message}</Text> : null}
              <View style={styles.enqFoot}><Text style={styles.enqWhen}>{timeAgo(e.createdAt)}</Text><View style={styles.pill}><Text style={styles.pillText}>{e.status}</Text></View></View>
            </Reveal>
          ))
            : <EmptyState icon="chatbubble-ellipses-outline" title="No enquiries yet" message="Tap “Enquire Now” on a property to contact the project team." action="Explore properties" onAction={() => navigation.navigate('Search')} />}
      </View>
    </Screen>
  );
}

// Matches an enquiry card: two-line title, three-line message, then the time and status pill.
function EnquirySkeletons({ rows = 3 }) {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.enq}>
          <SkeletonText size={15} width="75%" />
          <SkeletonText size={13.5} lineHeight={20} style={{ marginTop: 6 }} />
          <SkeletonText size={13.5} lineHeight={20} width="60%" />
          <View style={styles.enqFoot}>
            <SkeletonText size={12} width={56} />
            <Skeleton style={{ width: 64, height: 22, borderRadius: radius.pill }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Matches the history group: icon tile, title and meta line, chevron.
function HistorySkeletons({ rows = 4 }) {
  return (
    <View style={styles.group} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.hRow, i < rows - 1 && styles.hBorder]}>
          <Skeleton style={styles.hIc} />
          <View style={{ flex: 1 }}>
            <SkeletonText size={14.5} width="70%" />
            <SkeletonText size={12} width="45%" style={{ marginTop: 2 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Device-local history list (Recent searches).
function HistoryList({ navigation, title, load, clear, clearLabel, empty, renderRow }) {
  const [items, setItems] = React.useState(null);
  const reload = React.useCallback(() => load().then(setItems), [load]);
  React.useEffect(() => navigation.addListener('focus', reload), [navigation, reload]);
  React.useEffect(() => { reload(); }, [reload]);
  const onClear = async () => { await clear(); setItems([]); };
  return (
    <Screen>
      <ScreenHeader title={title} subtitle={items?.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : ' '} back />
      <View style={{ paddingHorizontal: 20 }}>
        {!items ? <HistorySkeletons /> : items.length ? (
          <>
            <View style={styles.group}>
              {items.map((it, i) => (
                <Reveal key={it.id} delay={stagger(i, 50, 6)}>
                  {renderRow(it, i === items.length - 1)}
                </Reveal>
              ))}
            </View>
            <PressableScale onPress={onClear} style={styles.clearBtn} accessibilityRole="button">
              <Text style={styles.clearText}>{clearLabel}</Text>
            </PressableScale>
          </>
        ) : <EmptyState {...empty} />}
      </View>
    </Screen>
  );
}

function HistoryRow({ icon, title, meta, onPress, last }) {
  return (
    <PressableScale onPress={onPress} to={0.97} style={[styles.hRow, !last && styles.hBorder]} accessibilityRole="button">
      <View style={styles.hIc}><Ionicons name={icon} size={18} color={colors.goldDeep} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.hTitle} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={styles.hMeta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#B5AFBB" />
    </PressableScale>
  );
}

export function RecentSearchesScreen({ navigation }) {
  const rerun = (s) => navigation.navigate('Search', {
    city: s.city || '', locality: s.locality || '', search: s.query || '', propertyType: s.propertyType || '', bhk: s.bhk || '',
  });
  return (
    <HistoryList
      navigation={navigation}
      title="Recent searches"
      load={getSearchHistory}
      clear={clearSearchHistory}
      clearLabel="Clear search history"
      empty={{ icon: 'time-outline', title: 'No recent searches', message: 'Searches you run will appear here so you can repeat them in one tap.', action: 'Start searching', onAction: () => navigation.navigate('Explore') }}
      renderRow={(s, last) => (
        <HistoryRow icon="search-outline" title={s.label || s.query || 'Search'} meta={timeAgo(s.timestamp)} onPress={() => rerun(s)} last={last} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  hBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  hIc: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.champagneSoft, alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  hMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  clearBtn: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 20, marginTop: 6 },
  clearText: { fontSize: 13.5, fontWeight: '700', color: colors.error },
  status: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8, maxWidth: '100%' },
  statusText: { fontSize: 12, fontWeight: '800' },
  reason: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.goldDeep },
  addText: { fontSize: 13, fontWeight: '800', color: colors.white },
  crud: { flexDirection: 'row', gap: 10, marginTop: 8 },
  crudBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, borderWidth: 1 },
  crudEdit: { backgroundColor: colors.champagneSoft, borderColor: colors.purpleBorder },
  crudDelete: { backgroundColor: '#FDF2F2', borderColor: '#F5C2C2' },
  crudText: { fontSize: 13.5, fontWeight: '800' },
  enq: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line },
  enqTitle: { fontWeight: '800', fontSize: 15, color: colors.ink },
  enqMsg: { color: colors.text, fontSize: 13.5, marginTop: 6, lineHeight: 20 },
  enqFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  enqWhen: { color: colors.muted, fontSize: 12 },
  pill: { backgroundColor: colors.champagneSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800', color: colors.ink, textTransform: 'capitalize' },
});
