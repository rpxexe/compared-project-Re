import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import ScreenHeader from '../components/ScreenHeader';
import FilterChip from '../components/FilterChip';
import PropertyCard from '../components/PropertyCard';
import Button from '../components/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { colors } from '../theme';
import Text from "../components/AppText";

const CATS = [
  { key: 'projects', label: 'All projects' }, { key: 'new-launch', label: 'New Launch' }, { key: 'upcoming', label: 'Upcoming' },
  { key: 'under-construction', label: 'Under Construction' }, { key: 'ready', label: 'Ready to Move' },
];

export default function NewProjectScreen() {
  const insets = useSafeAreaInsets();
  const cats = useApi(() => api.categories(), []);
  const [active, setActive] = useState('projects');
  const [items, setItems] = useState([]);
  const [pg, setPg] = useState({ page: 1, pages: 1, total: 0 });
  const [st, setSt] = useState({ loading: true, more: false, error: null });

  // A category chip is only shown when the database really has projects for it.
  const counts = cats.data?.counts || {};
  const visible = CATS.filter((c) => c.key === 'projects' || counts[c.key] > 0);

  const load = useCallback(async (page, append) => {
    setSt((s) => ({ ...s, loading: !append, more: append, error: null }));
    try {
      const r = await api.properties({ section: active, page, limit: 10 });
      setItems((prev) => (append ? [...prev, ...r.items.filter((n) => !prev.some((o) => o.id === n.id))] : r.items));
      setPg({ page: r.page, pages: r.pages, total: r.total });
      setSt({ loading: false, more: false, error: null });
    } catch (error) { setSt({ loading: false, more: false, error }); }
  }, [active]);
  useEffect(() => { load(1, false); }, [load]);
  useEffect(() => { if (cats.data && !visible.some((c) => c.key === active)) setActive('projects'); }, [cats.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8 }}>
        <ScreenHeader title="New Project" subtitle={st.loading && !items.length ? ' ' : `${pg.total} project${pg.total === 1 ? '' : 's'}`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 14 }}>
          {visible.map((c) => <FilterChip key={c.key} label={c.label} count={counts[c.key]} active={active === c.key} onPress={() => setActive(c.key)} />)}
        </ScrollView>
      </View>
      {st.loading && !items.length ? <View style={{ padding: 20 }}><LoadingState rows={4} /></View>
        : st.error && !items.length ? <ErrorState title="Unable to load projects" error={st.error} onRetry={() => load(1, false)} />
          : (
            <FlatList
              data={items} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 14 }}
              renderItem={({ item, index }) => <PropertyCard property={item} index={index} />}
              onEndReachedThreshold={0.4} onEndReached={() => { if (!st.more && !st.loading && pg.page < pg.pages) load(pg.page + 1, true); }}
              ListEmptyComponent={<EmptyState icon="business-outline" title="No projects found" message="There are no projects in this category yet." />}
              ListFooterComponent={st.more ? <ActivityIndicator color={colors.gold} style={{ margin: 16 }} /> : st.error ? <Button title="Retry" variant="ghost" small onPress={() => load(pg.page + 1, true)} /> : null}
            />
          )}
    </View>
  );
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.ivory } });
