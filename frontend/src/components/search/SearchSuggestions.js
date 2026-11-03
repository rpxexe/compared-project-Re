import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
import { getSearchHistory, removeSearchHistory, subscribeSearchHistory } from "../../services/historyService";
import { brand, colors, radius } from "../../theme";
import Text from "../AppText";

const MIN_CHARS = 2;
const PER_SECTION = 4;

// Developer names change rarely; one facets request serves every suggestion while the app runs.
let developersPromise = null;
const loadDevelopers = () => {
  developersPromise ||= api.facets().then((f) => (Array.isArray(f?.developers) ? f.developers : [])).catch(() => {
    developersPromise = null;
    return [];
  });
  return developersPromise;
};

// Suggestions under the filter screen's search field. Empty field: recent searches. While typing:
// matching locations (/properties/locations), project names (listing titles in the current tab)
// and developers (/properties/facets). Each pick turns into a real filter.
export default function SearchSuggestions({ text, context, onSearchText, onPickRecent, onPickLocation, onPickProject, onPickDeveloper }) {
  const typed = text.trim();
  const [recent, setRecent] = useState([]);
  const [found, setFound] = useState(null); // { locations, projects, developers } for `typed`
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    getSearchHistory().then((h) => alive && setRecent(h));
    const off = subscribeSearchHistory((h) => alive && setRecent(h));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (typed.length < MIN_CHARS) {
      setFound(null);
      setLoading(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      const q = typed.toLowerCase();
      const [locations, projects, developers] = await Promise.all([
        api.locations({ search: typed, limit: PER_SECTION }).then((r) => r?.locations || []).catch(() => []),
        api
          .properties({ context, project: typed, limit: 12, sort: "relevance" }, { signal: ctrl.signal })
          .then((r) => uniqueBy((r?.items || []).filter((p) => p.title), (p) => p.title.toLowerCase()).slice(0, PER_SECTION))
          .catch(() => []),
        loadDevelopers().then((all) => all.filter((d) => d.toLowerCase().includes(q)).slice(0, PER_SECTION)),
      ]);
      if (ctrl.signal.aborted) return;
      setFound({ locations, projects, developers });
      setLoading(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [typed, context]);

  if (typed.length < MIN_CHARS) {
    const items = recent.slice(0, 6);
    if (!items.length) return <Text style={styles.note}>Type a city, locality, project or developer.</Text>;
    return (
      <View>
        <Text style={styles.section}>Recent searches</Text>
        {items.map((it) => (
          <Row
            key={it.id}
            icon="time-outline"
            title={it.label}
            onPress={() => onPickRecent(it)}
            trailing={
              <Pressable onPress={() => removeSearchHistory(it.id)} hitSlop={10} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Remove ${it.label} from recent searches`}>
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            }
          />
        ))}
      </View>
    );
  }

  const none = found && !found.locations.length && !found.projects.length && !found.developers.length;
  return (
    <View>
      <Row icon="search" title={`Search "${typed}"`} sub="City, locality, project or developer" onPress={onSearchText} />
      {!found ? (
        <ActivityIndicator color={brand.violet} style={{ marginVertical: 16 }} />
      ) : (
        <View style={loading && { opacity: 0.6 }}>
          {found.locations.length ? <Text style={styles.section}>Locations</Text> : null}
          {found.locations.map((l) => (
            <Row
              key={`${l.locality}|${l.city}`}
              icon="location-outline"
              title={l.locality || l.city}
              sub={l.locality && l.city ? l.city : ""}
              match={typed}
              onPress={() => onPickLocation({ city: l.city || "", locality: l.locality || "" })}
            />
          ))}
          {found.projects.length ? <Text style={styles.section}>Projects</Text> : null}
          {found.projects.map((p) => (
            <Row
              key={p.id}
              icon="business-outline"
              title={p.title}
              sub={[p.locality, p.city].filter(Boolean).join(", ")}
              match={typed}
              onPress={() => onPickProject(p.title)}
            />
          ))}
          {found.developers.length ? <Text style={styles.section}>Developers</Text> : null}
          {found.developers.map((d) => (
            <Row key={d} icon="construct-outline" title={d} match={typed} onPress={() => onPickDeveloper(d)} />
          ))}
          {none ? <Text style={styles.note}>No suggestions for "{typed}". You can still search for it.</Text> : null}
        </View>
      )}
    </View>
  );
}

function uniqueBy(list, key) {
  const seen = new Set();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// The typed text, bolded wherever it appears in `title`.
function Highlighted({ title, match }) {
  const at = match ? title.toLowerCase().indexOf(match.toLowerCase()) : -1;
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <Text style={styles.hit}>{title.slice(at, at + match.length)}</Text>
      {title.slice(at + match.length)}
    </>
  );
}

function Row({ icon, title, sub, match, onPress, trailing }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: brand.lavender }]}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={17} color={brand.violet} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          <Highlighted title={title} match={match} />
        </Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {trailing || <Ionicons name="arrow-up-outline" size={16} color={colors.muted} style={styles.fill} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: "800", color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 8, borderRadius: radius.sm },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: brand.lavender },
  title: { fontSize: 14.5, color: colors.ink },
  hit: { fontWeight: "800", color: brand.deep },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 1 },
  fill: { transform: [{ rotate: "-45deg" }] },
  remove: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  note: { fontSize: 13.5, color: colors.muted, marginVertical: 12, textAlign: "center" },
});
