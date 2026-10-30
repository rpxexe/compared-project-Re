import React, { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Logo from '../components/Logo';
import Button from '../components/Button';
import PressableScale from '../components/PressableScale';
import { useEntrance } from '../hooks/useEntrance';
import { colors, fonts, radius, shadow } from '../theme';
import Text, { AnimatedText } from "../components/AppText";

const INTENTS = [
  { key: 'buy', label: 'Buy', icon: 'key-outline', note: 'Homes to own' },
  { key: 'rent', label: 'Rent', icon: 'home-outline', note: 'Move in soon' },
  { key: 'new-projects', label: 'New Projects', icon: 'sparkles-outline', note: 'Fresh launches' },
  { key: 'commercial', label: 'Commercial', icon: 'briefcase-outline', note: 'Offices & shops' },
  { key: 'plots', label: 'Plots', icon: 'map-outline', note: 'Land & plots' },
];

function IntentCard({ item, selected, onPress, delay }) {
  const enter = useEntrance(delay, 22);
  const ring = useRef(new Animated.Value(selected ? 1 : 0)).current;
  React.useEffect(() => { Animated.spring(ring, { toValue: selected ? 1 : 0, useNativeDriver: true, friction: 6 }).start(); }, [selected, ring]);
  return (
    <Animated.View style={[enter, { width: '48%' }]}>
      <PressableScale onPress={onPress} to={0.95} style={[styles.card, selected && styles.cardOn]} accessibilityRole="button" accessibilityState={{ selected }}>
        <View style={[styles.iconWrap, selected && { backgroundColor: colors.gold }]}>
          <Ionicons name={item.icon} size={22} color={selected ? colors.ink : colors.goldDeep} />
        </View>
        <Text style={[styles.cardTitle, selected && { color: colors.ivory }]}>{item.label}</Text>
        <Text style={[styles.cardNote, selected && { color: 'rgba(255,255,255,0.65)' }]}>{item.note}</Text>
        <Animated.View style={[styles.check, { opacity: ring, transform: [{ scale: ring }] }]}><Ionicons name="checkmark" size={14} color={colors.ink} /></Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

export default function IntentScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [intent, setIntent] = useState(null);
  const title = useEntrance(100, 24);
  const next = async () => {
    if (intent) await AsyncStorage.setItem('cp_intent', intent).catch(() => {});
    navigation.navigate('Login');
  };
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <LinearGradient colors={[colors.ink, colors.plum]} style={[styles.hero, { paddingTop: insets.top + 18 }]}>
          <Logo />
          <View style={styles.skyline} pointerEvents="none">
            {[44, 78, 56, 96, 64, 38].map((h, i) => <View key={i} style={{ width: 22, height: h, backgroundColor: i % 2 ? 'rgba(199,125,255,0.35)' : 'rgba(166,107,255,0.35)', borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />)}
          </View>
          <AnimatedText style={[styles.h1, title]}>Find the right property.{'\n'}<Text style={{ color: colors.gold }}>Compare before you decide.</Text></AnimatedText>
        </LinearGradient>
        <View style={{ padding: 20 }}>
          <Text style={styles.q}>What are you looking for?</Text>
          <View style={styles.grid}>
            {INTENTS.map((it, i) => <IntentCard key={it.key} item={it} selected={intent === it.key} delay={250 + i * 70} onPress={() => setIntent(intent === it.key ? null : it.key)} />)}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.cta, { paddingBottom: insets.bottom + 14 }]}>
        <Button title="Get Started" icon="arrow-forward" onPress={next} />
        <Text style={styles.hint}>Takes less than a minute · mobile number + OTP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ivory },
  hero: { paddingHorizontal: 22, paddingBottom: 34, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  skyline: { position: 'absolute', right: 18, top: 70, flexDirection: 'row', alignItems: 'flex-end', gap: 6, opacity: 0.9 },
  h1: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 41, color: colors.ivory, marginTop: 64 },
  q: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, minHeight: 124, borderWidth: 1.5, borderColor: colors.line, ...shadow.card },
  cardOn: { backgroundColor: colors.ink, borderColor: colors.gold },
  iconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.champagneSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  cardNote: { fontSize: 12, color: colors.muted, marginTop: 2 },
  check: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(246,242,255,0.96)' },
  hint: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 10 },
});
