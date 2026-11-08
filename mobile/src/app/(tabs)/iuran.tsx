import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import {
  Badge, Body, Button, Card, Empty, Loading, Muted, ProgressBar, Screen, SectionTitle, styles as ui,
} from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { BILL_STATUS_LABEL, PAYMENT_STATUS_LABEL, METHOD_LABEL, billPeriodLabel, rupiah, tanggal } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Bill, Due, Payment } from '@/lib/types';
import { must, useData } from '@/lib/useData';

type BillRow = Bill & { dues: Pick<Due, 'name' | 'frequency'> | null };
type PaymentRow = Payment & { dues: Pick<Due, 'name'> | null };

interface IuranData {
  bills: BillRow[];
  donations: (Due & { collected: number; contributors: number })[];
  payments: PaymentRow[];
}

export default function Iuran() {
  const { current, communityId, isPengurus } = useCurrentCommunity();

  const load = useCallback(async (): Promise<IuranData> => {
    const [bills, dues, totals, payments] = await Promise.all([
      supabase
        .from('bills')
        .select('*, dues(name, frequency)')
        .eq('community_id', communityId)
        .eq('membership_id', current.id)
        .order('period', { ascending: false })
        .limit(60),
      supabase.from('dues').select('*').eq('community_id', communityId).eq('kind', 'sukarela').eq('is_active', true),
      supabase.rpc('due_totals', { p_community_id: communityId }),
      supabase
        .from('payments')
        .select('*, dues(name)')
        .eq('community_id', communityId)
        .eq('membership_id', current.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    const totalMap = new Map(
      ((must(totals) ?? []) as { due_id: string; collected: number; contributors: number }[]).map((t) => [t.due_id, t]),
    );
    return {
      bills: (must(bills) ?? []) as BillRow[],
      donations: ((must(dues) ?? []) as Due[]).map((d) => ({
        ...d,
        collected: Number(totalMap.get(d.id)?.collected ?? 0),
        contributors: Number(totalMap.get(d.id)?.contributors ?? 0),
      })),
      payments: (must(payments) ?? []) as PaymentRow[],
    };
  }, [communityId, current.id]);

  const { data, loading, refreshing, refresh } = useData<IuranData | null>(load, null);
  if (loading || !data) return <Loading />;

  const unpaid = data.bills.filter((b) => b.status !== 'lunas');
  const paid = data.bills.filter((b) => b.status === 'lunas').slice(0, 12);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {isPengurus && (
        <View style={[ui.row, { gap: space.sm, marginBottom: space.sm }]}>
          <Button title="Kelola iuran" icon="settings-outline" small variant="secondary" onPress={() => router.push('/manage/dues')} />
          <Button title="Verifikasi" icon="checkmark-done-outline" small variant="secondary" onPress={() => router.push('/manage/verify')} />
        </View>
      )}

      <SectionTitle>Tagihan wajib</SectionTitle>
      {unpaid.length === 0 ? (
        <Empty icon="checkmark-circle-outline" text="Tidak ada tagihan yang perlu dibayar" />
      ) : (
        unpaid.map((b) => (
          <Card key={b.id}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>{b.dues?.name}</Body>
                <Muted>
                  {billPeriodLabel(b)} · jatuh tempo {tanggal(b.due_date)}
                </Muted>
              </View>
              <Body style={{ fontWeight: '800' }}>{rupiah(b.amount)}</Body>
            </View>
            <View style={[ui.row, { justifyContent: 'space-between', marginTop: space.md }]}>
              <Badge
                text={BILL_STATUS_LABEL[b.status]}
                tone={b.status === 'menunggu_verifikasi' ? 'warning' : 'danger'}
              />
              {b.status === 'belum_bayar' && (
                <Button title="Bayar" small onPress={() => router.push({ pathname: '/pay', params: { billId: b.id } })} />
              )}
            </View>
          </Card>
        ))
      )}

      <SectionTitle>Iuran sukarela / donasi</SectionTitle>
      {data.donations.length === 0 ? (
        <Empty icon="heart-outline" text="Belum ada penggalangan dana" />
      ) : (
        data.donations.map((d) => (
          <Card key={d.id}>
            <Body style={{ fontWeight: '700' }}>{d.name}</Body>
            {d.description ? <Muted>{d.description}</Muted> : null}
            <Body style={{ marginTop: space.sm, fontWeight: '700', color: colors.primary }}>
              {rupiah(d.collected)}
              {d.target_amount ? <Muted> dari {rupiah(d.target_amount)}</Muted> : null}
            </Body>
            {d.target_amount ? <ProgressBar value={d.collected / Number(d.target_amount)} /> : null}
            <View style={[ui.row, { justifyContent: 'space-between', marginTop: space.md }]}>
              <Muted>{d.contributors} penyumbang</Muted>
              <Button
                title="Ikut menyumbang"
                small
                icon="heart"
                onPress={() => router.push({ pathname: '/pay', params: { dueId: d.id } })}
              />
            </View>
          </Card>
        ))
      )}

      <SectionTitle>Riwayat pembayaran</SectionTitle>
      {data.payments.length === 0 ? (
        <Empty text="Belum ada pembayaran" />
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {data.payments.map((p) => (
            <View key={p.id} style={{ paddingVertical: space.sm }}>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Body style={{ flex: 1 }} numberOfLines={1}>
                  {p.dues?.name}
                </Body>
                <Body style={{ fontWeight: '700' }}>{rupiah(p.amount)}</Body>
              </View>
              <View style={[ui.row, { justifyContent: 'space-between', marginTop: 2 }]}>
                <Muted>
                  {tanggal(p.created_at)} · {METHOD_LABEL[p.method]}
                </Muted>
                <Badge
                  text={PAYMENT_STATUS_LABEL[p.status]}
                  tone={p.status === 'diterima' ? 'success' : p.status === 'ditolak' ? 'danger' : 'warning'}
                />
              </View>
              {p.status === 'ditolak' && p.reject_reason ? (
                <Muted style={{ color: colors.danger }}>Alasan: {p.reject_reason}</Muted>
              ) : null}
            </View>
          ))}
        </Card>
      )}

      {paid.length > 0 && (
        <>
          <SectionTitle>Tagihan lunas</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {paid.map((b) => (
              <View key={b.id} style={[ui.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                <Muted style={{ flex: 1 }}>
                  {b.dues?.name} · {billPeriodLabel(b)}
                </Muted>
                <Badge text="Lunas" tone="success" />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
