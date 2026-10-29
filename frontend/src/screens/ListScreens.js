import React from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import ScreenHeader from '../components/ScreenHeader';
import PropertyCard from '../components/PropertyCard';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { timeAgo } from '../utils/format';
import { colors, radius } from '../theme';

const STATUS = { pending: ['Pending review', '#6D28D9', '#EBE2FF'], approved: ['Live', '#3F7D5C', '#E4F1E9'], rejected: ['Rejected', '#C96B6B', '#F6E3E3'] };

export function SavedScreen({ navigation }) {
  const { data, loading, error, reload, refresh } = useApi(() => api.saved(), []);
  const [r, setR] = React.useState(false);
  React.useEffect(() => navigation.addListener('focus', () => refresh()), [navigation]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen refreshControl={<RefreshControl refreshing={r} onRefresh={async () => { setR(true); await refresh(); setR(false); }} tintColor={colors.gold} />}>
      <ScreenHeader title="Saved properties" back />
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {loading && !data ? <LoadingState rows={3} /> : error && !data ? <ErrorState title="Unable to load saved properties" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((p, i) => <PropertyCard key={p.id} property={p} index={i} />)
            : <EmptyState icon="heart-outline" title="No saved properties yet" message="Tap the heart on any property to keep it here." action="Explore properties" onAction={() => navigation.navigate('Search')} />}
      </View>
    </Screen>
  );
}

export function MyPropertiesScreen({ navigation }) {
  const { data, loading, error, reload, refresh } = useApi(() => api.myProperties(), []);
  React.useEffect(() => navigation.addListener('focus', () => refresh()), [navigation]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen>
      <ScreenHeader title="My properties" back />
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {loading && !data ? <LoadingState rows={3} /> : error && !data ? <ErrorState title="Unable to load your properties" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((p, i) => {
            const s = STATUS[p.approvalStatus] || STATUS.approved;
            return (
              <View key={p.id}>
                <View style={[styles.status, { backgroundColor: s[2] }]}><Text style={[styles.statusText, { color: s[1] }]}>{s[0]}</Text>{p.rejectionReason ? <Text style={styles.reason}> · {p.rejectionReason}</Text> : null}</View>
                <PropertyCard property={p} index={i} />
              </View>
            );
          })
            : <EmptyState icon="home-outline" title="You haven't posted any property" message="Listings you post will appear here with their review status." action="Post a property" onAction={() => navigation.navigate('Tabs', { screen: 'Post' })} />}
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
        {loading && !data ? <LoadingState rows={3} /> : error && !data ? <ErrorState title="Unable to load enquiries" error={error} onRetry={reload} />
          : data.items.length ? data.items.map((e) => (
            <View key={e.id} style={styles.enq}>
              <Text style={styles.enqTitle} numberOfLines={2}>{e.propertyTitle || 'Property'}</Text>
              {e.message ? <Text style={styles.enqMsg} numberOfLines={3}>{e.message}</Text> : null}
              <View style={styles.enqFoot}><Text style={styles.enqWhen}>{timeAgo(e.createdAt)}</Text><View style={styles.pill}><Text style={styles.pillText}>{e.status}</Text></View></View>
            </View>
          ))
            : <EmptyState icon="chatbubble-ellipses-outline" title="No enquiries yet" message="Tap “Enquire Now” on a property to contact the project team." action="Explore properties" onAction={() => navigation.navigate('Search')} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8, maxWidth: '100%' },
  statusText: { fontSize: 12, fontWeight: '800' },
  reason: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  enq: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line },
  enqTitle: { fontWeight: '800', fontSize: 15, color: colors.ink },
  enqMsg: { color: colors.text, fontSize: 13.5, marginTop: 6, lineHeight: 20 },
  enqFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  enqWhen: { color: colors.muted, fontSize: 12 },
  pill: { backgroundColor: colors.champagneSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800', color: colors.ink, textTransform: 'capitalize' },
});
