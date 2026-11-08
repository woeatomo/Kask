import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, Body, Button, Card, Empty, Fab, Loading, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { addMonths, bulanTahun, isoDate, monthStart, rupiah } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Due } from '@/lib/types';
import { must, useData } from '@/lib/useData';

export default function ManageDues() {
  const { communityId, canManageRt, scopeRtUnitId, rtLabel } = useCurrentCommunity();
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await supabase.from('dues').select('*').eq('community_id', communityId).order('created_at');
    return (must(res) ?? []) as Due[];
  }, [communityId]);
  const { data, loading, refreshing, refresh } = useData<Due[]>(load, []);
  if (loading) return <Loading />;

  const wajib = data.filter((d) => d.kind === 'wajib');
  const sukarela = data.filter((d) => d.kind === 'sukarela');

  function generate(d: Due) {
    const period = d.frequency === 'bulanan' ? month : new Date();
    const label = d.frequency === 'bulanan' ? bulanTahun(month) : 'hari ini';
    const target = scopeRtUnitId
      ? `warga ${rtLabel(scopeRtUnitId)}`
      : d.rt_unit_id
        ? `warga ${rtLabel(d.rt_unit_id) ?? 'RT terkait'}`
        : 'semua warga aktif';
    Alert.alert('Buat tagihan', `Buat tagihan "${d.name}" ${rupiah(d.amount)} untuk ${label} bagi ${target}?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Buat',
        onPress: async () => {
          setBusy(d.id);
          const { data: n, error } = await supabase.rpc('generate_bills', { p_due_id: d.id, p_period: isoDate(period) });
          setBusy(null);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          Alert.alert('Selesai', n ? `${n} tagihan baru dibuat.` : 'Semua warga sudah memiliki tagihan untuk periode ini.');
        },
      },
    ]);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} footer={<Fab onPress={() => router.push('/manage/due-form')} />}>
      <Card>
        <Muted>Periode tagihan bulanan</Muted>
        <View style={[ui.row, { justifyContent: 'space-between', marginTop: space.xs }]}>
          <Pressable onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>{bulanTahun(month)}</Text>
          <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={12}>
            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      <SectionTitle>Iuran wajib</SectionTitle>
      {wajib.length === 0 && <Empty text="Belum ada iuran wajib. Tambahkan dengan tombol +" />}
      {wajib.map((d) => (
        <Card key={d.id}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{d.name}</Body>
              <Muted>
                {rupiah(d.amount)} · {d.frequency === 'bulanan' ? `bulanan, jatuh tempo tgl ${d.due_day}` : 'sekali bayar'}
              </Muted>
              <Muted>{d.rt_unit_id ? `Khusus ${rtLabel(d.rt_unit_id) ?? 'RT'}` : 'Seluruh warga'}</Muted>
            </View>
            {!d.is_active && <Badge text="Nonaktif" />}
          </View>
          <View style={[ui.row, { gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }]}>
            {d.is_active && (canManageRt(d.rt_unit_id) || (!!scopeRtUnitId && !d.rt_unit_id)) && (
              <Button title="Buat tagihan" small icon="add" loading={busy === d.id} onPress={() => generate(d)} />
            )}
            <Button
              title="Lihat tagihan"
              small
              variant="secondary"
              onPress={() => router.push({ pathname: '/manage/bills', params: { dueId: d.id, period: isoDate(month) } })}
            />
            {canManageRt(d.rt_unit_id) && (
              <Button title="Edit" small variant="ghost" onPress={() => router.push({ pathname: '/manage/due-form', params: { id: d.id } })} />
            )}
          </View>
        </Card>
      ))}

      <SectionTitle>Iuran sukarela / donasi</SectionTitle>
      {sukarela.length === 0 && <Empty icon="heart-outline" text="Belum ada penggalangan dana" />}
      {sukarela.map((d) => (
        <Card
          key={d.id}
          onPress={canManageRt(d.rt_unit_id) ? () => router.push({ pathname: '/manage/due-form', params: { id: d.id } }) : undefined}
        >
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{d.name}</Body>
              <Muted>
                {d.target_amount ? `Target ${rupiah(d.target_amount)}` : 'Tanpa target'}
                {d.rt_unit_id ? ` · Khusus ${rtLabel(d.rt_unit_id) ?? 'RT'}` : ''}
              </Muted>
            </View>
            {!d.is_active ? <Badge text="Ditutup" /> : <Badge text="Aktif" tone="success" />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
