import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stars, StarPicker } from './Stars';
import BottomSheet from './BottomSheet';
import Button from './Button';
import PressableScale from './PressableScale';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { colors, fonts, radius, shadow, glass } from '../theme';
import { timeAgo } from '../utils/format';
import Text, { AppTextInput as TextInput } from "./AppText";

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function RatingSummary({ summary }) {
  const total = summary?.count || 0;
  return (
    <View style={styles.sum}>
      <View style={styles.big}>
        <Text style={styles.avg}>{total ? summary.average.toFixed(1) : '–'}</Text>
        <Stars value={total ? summary.average : 0} size={14} />
        <Text style={styles.cnt}>{total ? `${total} rating${total > 1 ? 's' : ''}` : 'No ratings yet'}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {[5, 4, 3, 2, 1].map((n) => {
          const c = summary?.distribution?.[n] || 0;
          return (
            <View key={n} style={styles.barRow}>
              <Text style={styles.barN}>{n}</Text>
              <View style={styles.track}><View style={[styles.fill, { width: total ? `${(c / total) * 100}%` : '0%' }]} /></View>
              <Text style={styles.barC}>{c}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ReviewItem({ r }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(r.userName || 'V').charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{r.mine ? 'You' : r.userName}</Text>
          <Text style={styles.when}>{timeAgo(r.createdAt)}</Text>
        </View>
        <Stars value={r.rating} size={13} />
      </View>
      {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
    </View>
  );
}

// Ratings & reviews block for the property detail screen. `onChanged` lets the parent refresh cards.
export default function ReviewsSection({ propertyId, isOwner, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setData(await api.reviews(propertyId, { limit: 10 })); setError(null); } catch (e) { setError(e); }
  };
  useEffect(() => { load(); }, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = data?.myReview;
  const openSheet = () => { setRating(mine?.rating || 0); setComment(mine?.comment || ''); setOpen(true); };

  const submit = async () => {
    if (!rating) { toast.show('Tap a star to choose your rating', 'info'); return; }
    setSaving(true);
    try {
      await api.addReview(propertyId, rating, comment.trim());
      setOpen(false);
      toast.show(mine ? 'Your rating was updated' : 'Thanks for rating this project', 'success');
      await load(); onChanged?.();
    } catch (e) { toast.show(e.message, 'error'); } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try { await api.deleteMyReview(propertyId); setOpen(false); toast.show('Your rating was removed', 'success'); await load(); onChanged?.(); }
    catch (e) { toast.show(e.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <View>
      {error && !data ? (
        <PressableScale onPress={load} style={styles.retry}><Text style={styles.retryText}>Unable to load ratings. Tap to retry.</Text></PressableScale>
      ) : data ? (
        <>
          <RatingSummary summary={data.summary} />
          {!isOwner ? <Button title={mine ? 'Edit your rating' : 'Rate this project'} icon="star-outline" variant="dark" small onPress={openSheet} style={{ marginTop: 16 }} /> : null}
          {data.items.length ? <View style={{ marginTop: 6 }}>{data.items.map((r) => <ReviewItem key={r.id} r={r} />)}</View> : <Text style={styles.empty}>Be the first to share your experience with this project.</Text>}
        </>
      ) : <Text style={styles.empty}>Loading ratings…</Text>}

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Rate this project">
        <StarPicker value={rating} onChange={setRating} />
        <Text style={styles.word}>{WORDS[rating] || 'Tap a star'}</Text>
        <TextInput value={comment} onChangeText={setComment} placeholder="Share what you liked or didn't (optional)" placeholderTextColor="#A9A3B0" multiline maxLength={500} style={styles.input} />
        <Text style={styles.counter}>{comment.length}/500</Text>
        <Button title={mine ? 'Update rating' : 'Submit rating'} onPress={submit} loading={saving} style={{ marginTop: 8 }} />
        {mine ? <Button title="Remove my rating" variant="ghost" small onPress={remove} disabled={saving} style={{ marginTop: 10 }} /> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...shadow.glass,
  },
  big: { alignItems: 'center', minWidth: 92 },
  avg: { fontFamily: fonts.serif, fontSize: 42, color: colors.ink, lineHeight: 48 },
  cnt: { fontSize: 11.5, color: colors.muted, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barN: { width: 10, fontSize: 11.5, fontWeight: '700', color: colors.muted },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.lavender, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.gold },
  barC: { width: 20, textAlign: 'right', fontSize: 11.5, color: colors.muted },
  item: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(253, 248, 237, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.glass,
  },
  avatarText: { fontWeight: '800', color: colors.goldDeep },
  name: { fontWeight: '700', color: colors.ink, fontSize: 13.5 },
  when: { fontSize: 11, color: colors.muted },
  comment: { marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.text },
  empty: { color: colors.muted, fontSize: 13.5, marginTop: 14, textAlign: 'center' },
  retry: { backgroundColor: '#F6E3E3', borderRadius: radius.md, padding: 14 },
  retryText: { color: colors.error, fontWeight: '700', textAlign: 'center' },
  word: { textAlign: 'center', marginTop: 10, fontWeight: '800', color: colors.goldDeep, fontSize: 15, minHeight: 22 },
  input: {
    marginTop: 14,
    minHeight: 96,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: radius.md,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 14,
    fontSize: 14.5,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  counter: { textAlign: 'right', color: colors.muted, fontSize: 11, marginTop: 4 },
});
