import { router } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { Badge, Body, Card, Empty, ListItem, Loading, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { communityLabel, isoDate, rupiah, tanggal } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { CashReport, News } from '@/lib/types';
import { must, useData } from '@/lib/useData';

interface HomeData {
  balance: number;
  unpaidCount: number;
  unpaidTotal: number;
  pendingPayments: number;
  pendingMembers: number;
  news: News[];
}

export default function Home() {
  const { profile } = useAuth();
  const { current, communityId, isPengurus } = useCurrentCommunity();

  const load = useCallback(async (): Promise<HomeData> => {
    const [report, bills, news] = await Promise.all([
      supabase.rpc('cash_report', { p_community_id: communityId, p_from: '2000-01-01', p_to: isoDate(new Date()) }),
      supabase
        .from('bills')
        .select('amount')
        .eq('community_id', communityId)
        .eq('membership_id', current.id)
        .neq('status', 'lunas'),
      supabase
        .from('news')
        .select('*')
        .eq('community_id', communityId)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(3),
    ]);
    const unpaid = must(bills) ?? [];
    let pendingPayments = 0;
    let pendingMembers = 0;
    if (isPengurus) {
      const [p, m] = await Promise.all([
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'menunggu'),
        supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'pending'),
      ]);
      pendingPayments = p.count ?? 0;
      pendingMembers = m.count ?? 0;
    }
    return {
      balance: Number((must(report) as CashReport).closing_balance),
      unpaidCount: unpaid.length,
      unpaidTotal: unpaid.reduce((s, b) => s + Number(b.amount), 0),
      pendingPayments,
      pendingMembers,
      news: (must(news) ?? []) as News[],
    };
  }, [communityId, current.id, isPengurus]);

  const { data, loading, refreshing, refresh } = useData<HomeData | null>(load, null);
  if (loading || !data) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Muted>Halo,</Muted>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{profile?.full_name || 'Warga'}</Text>
      <View style={[ui.row, { gap: space.sm, marginTop: 4, marginBottom: space.lg }]}>
        <Badge text={current.position || (current.role === 'warga' ? 'Warga' : current.role)} tone="info" />
        <Muted>{communityLabel(current.communities)}</Muted>
      </View>

      <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }} onPress={() => router.push('/kas')}>
        <Text style={{ color: '#CCFBF1', fontSize: 13 }}>Saldo kas</Text>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 }}>{rupiah(data.balance)}</Text>
        <Text style={{ color: '#CCFBF1', fontSize: 12, marginTop: 4 }}>Ketuk untuk melihat laporan kas</Text>
      </Card>

      <Card onPress={() => router.push('/iuran')}>
        <Muted>Tagihan saya</Muted>
        {data.unpaidCount === 0 ? (
          <Body style={{ fontWeight: '700', color: colors.success, marginTop: 4 }}>Semua tagihan lunas ✓</Body>
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.danger, marginTop: 4 }}>{rupiah(data.unpaidTotal)}</Text>
            <Muted>{data.unpaidCount} tagihan belum lunas · ketuk untuk bayar</Muted>
          </>
        )}
      </Card>

      {isPengurus && (
        <>
          <SectionTitle>Tugas pengurus</SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            <ListItem
              icon="checkmark-done-outline"
              title="Verifikasi pembayaran"
              subtitle={data.pendingPayments ? `${data.pendingPayments} menunggu` : 'Tidak ada'}
              right={data.pendingPayments ? <Badge text={String(data.pendingPayments)} tone="warning" /> : undefined}
              onPress={() => router.push('/manage/verify')}
            />
            <ListItem
              icon="person-add-outline"
              title="Permintaan bergabung"
              subtitle={data.pendingMembers ? `${data.pendingMembers} menunggu` : 'Tidak ada'}
              right={data.pendingMembers ? <Badge text={String(data.pendingMembers)} tone="warning" /> : undefined}
              onPress={() => router.push('/manage/members')}
            />
            <ListItem icon="receipt-outline" title="Kelola iuran & tagihan" onPress={() => router.push('/manage/dues')} />
          </Card>
        </>
      )}

      <SectionTitle>Berita terbaru</SectionTitle>
      {data.news.length === 0 ? (
        <Empty icon="newspaper-outline" text="Belum ada berita" />
      ) : (
        data.news.map((n) => (
          <Card key={n.id} onPress={() => router.push({ pathname: '/news/[id]', params: { id: n.id } })}>
            {n.is_pinned && <Badge text="📌 Disematkan" tone="info" />}
            <Body style={{ fontWeight: '700', marginTop: n.is_pinned ? 6 : 0 }}>{n.title}</Body>
            <Muted>{tanggal(n.published_at)}</Muted>
            <Body style={{ marginTop: 6 }} numberOfLines={2}>
              {n.body}
            </Body>
          </Card>
        ))
      )}
    </Screen>
  );
}
