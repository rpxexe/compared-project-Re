import React, { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../theme";
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
  property: { name: "home-outline", color: colors.champagneDeep },
  price: { name: "trending-down-outline", color: colors.success },
  saved: { name: "heart-outline", color: colors.rose },
  info: { name: "information-circle-outline", color: colors.plum },
};

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications],
  );

  const markAllRead = () => {
    setNotifications((items) =>
      items.map((item) => ({ ...item, unread: false })),
    );
  };

  const openNotification = (id) => {
    setNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.ivory} />

      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={markAllRead}
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
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {notifications.map((item) => {
          const icon = ICONS[item.type] || ICONS.info;

          return (
            <Pressable
              key={item.id}
              onPress={() => openNotification(item.id)}
              style={[styles.card, item.unread && styles.cardUnread]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${icon.color}18` },
                ]}
              >
                <Ionicons name={icon.name} size={20} color={icon.color} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.unread ? <View style={styles.unreadDot} /> : null}
                </View>

                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
            </Pressable>
          );
        })}

        {notifications.length === 0 ? (
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
    </SafeAreaView>
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
    borderBottomColor: colors.border,
    backgroundColor: colors.ivory,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
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
    backgroundColor: colors.night,
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
    color: colors.champagneDeep,
    fontSize: 11,
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
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    borderColor: "#D9CCF3",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
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
    width: 7,
    height: 7,
    marginLeft: 8,
    borderRadius: 4,
    backgroundColor: colors.champagneDeep,
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
