import { useCallback, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { Body, Button, Card, Empty, Loading, Muted, Screen, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { METHOD_LABEL, billPeriodLabel, rupiah, tanggal } from '@/lib/format';
import { signedUrl } from '@/lib/storage';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Payment } from '@/lib/types';
import { must, useData } from '@/lib/useData';

type Row = Payment & {
  dues: { name: string; kind: string; frequency: string } | null;
  bills: { period: string } | null;
  memberships: { address: string | null; profiles: { full_name: string } | null } | null;
  proofUrl?: string | null;
};

const REASONS = ['Bukti tidak jelas', 'Nominal tidak sesuai', 'Dana belum masuk'];

export default function Verify() {
  const { communityId } = useCurrentCommunity();
  const [busy, setBusy] = useState<string | null>(null);
  const sheet = useActionSheet();

  const load = useCallback(async () => {
    const res = await supabase
      .from('payments')
      .select('*, dues(name, kind, frequency), bills(period), memberships(address, profiles(full_name))')
      .eq('community_id', communityId)
      .eq('status', 'menunggu')
      .order('created_at');
    const rows = (must(res) ?? []) as Row[];
    return Promise.all(rows.map(async (r) => ({ ...r, proofUrl: await signedUrl('payment-proofs', r.proof_path) })));
  }, [communityId]);

  const { data, setData, loading, refreshing, refresh } = useData<Row[]>(load, []);
  if (loading) return <Loading />;

  async function decide(p: Row, accept: boolean, reason?: string) {
    setBusy(p.id);
    const { error } = await supabase.rpc('verify_payment', { p_payment_id: p.id, p_accept: accept, p_reason: reason ?? null });
    setBusy(null);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    setData((rows) => rows.filter((r) => r.id !== p.id));
  }

  function reject(p: Row) {
    sheet({
      title: 'Tolak pembayaran',
      message: 'Pilih alasan penolakan',
      options: REASONS.map((r) => ({ label: r, destructive: true, onPress: () => decide(p, false, r) })),
    });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {data.length === 0 && <Empty icon="checkmark-done-circle-outline" text="Tidak ada pembayaran yang menunggu verifikasi" />}
      {data.map((p) => (
        <Card key={p.id}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{p.memberships?.profiles?.full_name || 'Warga'}</Body>
              <Muted>{p.memberships?.address || '-'}</Muted>
            </View>
            <Body style={{ fontWeight: '800', fontSize: 17 }}>{rupiah(p.amount)}</Body>
          </View>
          <Muted style={{ marginTop: space.sm }}>
            {p.dues?.name}
            {p.bills && p.dues ? ` · ${billPeriodLabel({ period: p.bills.period, dues: p.dues })}` : ''}
          </Muted>
          <Muted>
            {METHOD_LABEL[p.method]} · {tanggal(p.created_at)}
          </Muted>
          {p.note ? <Body style={{ marginTop: 4 }}>“{p.note}”</Body> : null}
          {p.proofUrl ? (
            <Image source={{ uri: p.proofUrl }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 10, marginTop: space.sm }} resizeMode="contain" />
          ) : (
            <Muted style={{ marginTop: space.sm, fontStyle: 'italic' }}>Tanpa bukti foto</Muted>
          )}
          <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
            <Button title="Terima" icon="checkmark" loading={busy === p.id} onPress={() => decide(p, true)} style={{ flex: 1 }} />
            <Button title="Tolak" icon="close" variant="danger" disabled={busy === p.id} onPress={() => reject(p)} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
