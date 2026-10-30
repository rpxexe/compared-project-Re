import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, View, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import PressableScale from "../components/PressableScale";
import { colors, fonts, radius, shadow } from "../theme";
import Text from "../components/AppText";

const INITIAL_NOTIFICATIONS = [
  {
    id: "1",
    type: "property",
    title: "New project match",
    message: "A new property matching your preferences is now available.",
    time: "10 min ago",
    unread: true,
  },
  {
    id: "2",
    type: "price",
    title: "Price update",
    message: "A property you viewed recently has a new price.",
    time: "1 hr ago",
    unread: true,
  },
  {
    id: "3",
    type: "saved",
    title: "Saved property reminder",
    message: "Your saved properties are waiting for you.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "4",
    type: "info",
    title: "Welcome to Compare Project",
    message: "Compare projects, save homes and discover better options.",
    time: "2 days ago",
    unread: false,
  },
];

const ICONS = {
  property: { name: "home-outline", color: colors.goldDeep },
  price: { name: "trending-down-outline", color: colors.success },
  saved: { name: "heart-outline", color: colors.rose },
  info: { name: "information-circle-outline", color: colors.plum },
};

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await api.notifications();
      setNotifications(Array.isArray(result.items) ? result.items : []);
    } catch (e) {
      setError(e?.message || "Could not load notifications. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const formatTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications],
  );

  const markAllRead = async () => {
    if (!unreadCount) return;
    try {
      await api.markAllNotificationsRead();
      setNotifications((items) =>
        items.map((item) => ({ ...item, unread: false })),
      );
    } catch (e) {
      setError(e?.message || "Could not mark notifications as read.");
    }
  };

  const openNotification = async (item) => {
    if (!item.unread) return;
    try {
      await api.markNotificationRead(item.id);
      setNotifications((items) =>
        items.map((current) =>
          current.id === item.id ? { ...current, unread: false } : current,
        ),
      );
    } catch (e) {
      setError(e?.message || "Could not update notification.");
    }
  };

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.ivory} />

      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          to={0.88}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </PressableScale>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        <PressableScale
          onPress={markAllRead}
          to={0.92}
          disabled={unreadCount === 0}
          style={styles.readButton}
        >
          <Text
            style={[
              styles.readButtonText,
              unreadCount === 0 && styles.readButtonDisabled,
            ]}
          >
            Read all
          </Text>
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
          />
        }
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.champagneDeep} />
            <Text style={styles.emptyText}>Loading notifications…</Text>
          </View>
        ) : null}
        {!loading && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadNotifications()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading &&
          notifications.map((item) => {
            const icon = ICONS[item.type] || ICONS.info;

          return (
            <PressableScale
              key={item.id}
              to={0.97}
              onPress={() => openNotification(item.id)}
              style={[styles.card, item.unread && styles.cardUnread]}
            >
              {/* Frosted Glass Layers */}
              <LinearGradient
                colors={
                  item.unread
                    ? ["rgba(255, 255, 255, 0.95)", "rgba(246, 242, 255, 0.85)"]
                    : ["rgba(255, 255, 255, 0.9)", "rgba(255, 255, 255, 0.7)"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.7)", "rgba(255, 255, 255, 0.05)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.5 }}
                style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]}
                pointerEvents="none"
              />

              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${icon.color}18` },
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: `${icon.color}18` },
                  ]}
                >
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>

                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
            </PressableScale>
          );
        })}

        {!loading && !error && notifications.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="notifications-off-outline"
              size={42}
              color={colors.muted}
            />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptyText}>
              New property and account updates will appear here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(225, 216, 245, 0.6)",
    backgroundColor: "rgba(246, 242, 255, 0.9)",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    ...shadow.glass,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  countBadge: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  countText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },
  readButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  readButtonText: {
    color: colors.goldDeep,
    fontSize: 12,
    fontWeight: "800",
  },
  readButtonDisabled: {
    color: colors.muted,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    marginBottom: 12,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
    ...shadow.glass,
  },
  cardUnread: {
    borderColor: "rgba(166, 107, 255, 0.6)",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    zIndex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginLeft: 8,
    borderRadius: 4,
    backgroundColor: colors.rose,
  },
  message: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  time: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 7,
    fontWeight: "600",
  },
  loading: { alignItems: "center", paddingTop: 70, gap: 12 },
  errorBox: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: "center",
  },
  errorText: { color: colors.text, textAlign: "center", fontSize: 12 },
  retryText: { color: colors.champagneDeep, fontWeight: "800", marginTop: 10 },
  empty: {
    alignItems: "center",
    paddingHorizontal: 35,
    paddingTop: 100,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
  },
});
