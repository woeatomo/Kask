import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { useAuth } from '@/context/AuthContext';
import { exportBillsRecapPdf } from '@/lib/pdf';
import { Badge, Body, Card, Chips, Empty, Loading, Muted, ProgressBar, Screen, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { BILL_STATUS_LABEL, addMonths, billPeriodLabel, bulanTahun, isoDate, monthStart, parseDate, rupiah } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Bill, BillStatus, Due } from '@/lib/types';
import { must, useData } from '@/lib/useData';

type BillRow = Bill & {
  memberships: { address: string | null; profiles: { full_name: string } | null; rt_units: { rt_number: string } | null } | null;
};

type Filter = 'semua' | BillStatus;

export default function ManageBills() {
  const params = useLocalSearchParams<{ dueId: string; period?: string }>();
  const { current, communityId, scopeRtUnitId, rtLabel, isPremium } = useCurrentCommunity();

  // Rekap tagihan berisi data pribadi warga: cegah screenshot selama layar terbuka
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync('rekap-tagihan').catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync('rekap-tagihan').catch(() => {});
    };
  }, []);
  const { profile } = useAuth();
  const [month, setMonth] = useState(() => monthStart(params.period ? parseDate(params.period) : new Date()));
  const [filter, setFilter] = useState<Filter>('semua');
  const sheet = useActionSheet();
  const monthStr = isoDate(month);

  const load = useCallback(async () => {
    const due = must(await supabase.from('dues').select('*').eq('id', params.dueId).single()) as Due;
    let q = supabase
      .from('bills')
      .select('*, memberships(address, profiles(full_name), rt_units:rt_units!memberships_rt_unit_id_community_id_fkey(rt_number))')
      .eq('community_id', communityId)
      .eq('due_id', params.dueId)
      .order('period', { ascending: false });
    if (due.frequency === 'bulanan') q = q.eq('period', monthStr);
    const bills = (must(await q) ?? []) as BillRow[];
    bills.sort((a, b) => (a.memberships?.profiles?.full_name ?? '').localeCompare(b.memberships?.profiles?.full_name ?? ''));
    return { due, bills };
  }, [communityId, params.dueId, monthStr]);

  const { data, loading, refreshing, refresh, reload } = useData<{ due: Due; bills: BillRow[] } | null>(load, null);
  if (loading || !data) return <Loading />;
  const { due, bills } = data;

  const lunas = bills.filter((b) => b.status === 'lunas');
  const collected = lunas.reduce((s, b) => s + Number(b.amount), 0);
  const total = bills.reduce((s, b) => s + Number(b.amount), 0);
  const shown = filter === 'semua' ? bills : bills.filter((b) => b.status === filter);

  async function exportPdf() {
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    try {
      await exportBillsRecapPdf({
        community: current.communities,
        dueName: due.name,
        periodLabel: due.frequency === 'bulanan' ? bulanTahun(month) : 'Semua periode',
        scopeLabel: scopeRtUnitId ? `Warga ${rtLabel(scopeRtUnitId)}` : null,
        bills: bills.map((b) => ({
          name: b.memberships?.profiles?.full_name || 'Warga',
          rt: b.memberships?.rt_units ? `RT ${b.memberships.rt_units.rt_number}` : null,
          address: b.memberships?.address ?? null,
          amount: b.amount,
          status: b.status,
          paid_at: b.paid_at,
        })),
        printedBy: profile?.full_name || 'Pengurus',
        signers: scopeRtUnitId ? ['Bendahara', `Ketua ${rtLabel(scopeRtUnitId)}`] : undefined,
      });
    } catch (e) {
      Alert.alert('Gagal membuat PDF', errorMessage(e));
    }
  }

  function actions(b: BillRow) {
    const name = b.memberships?.profiles?.full_name || 'Warga';
    if (b.status === 'lunas') return;
    sheet({
      title: name,
      message: `${due.name} · ${billPeriodLabel({ period: b.period, dues: due })} · ${rupiah(b.amount)}`,
      options: [
      {
        label: 'Catat bayar tunai (lunas)',
        onPress: async () => {
          const { error } = await supabase.from('payments').insert({
            community_id: communityId,
            due_id: due.id,
            membership_id: b.membership_id,
            bill_id: b.id,
            amount: b.amount,
            method: 'tunai',
            status: 'diterima',
            note: 'Dicatat oleh pengurus',
          });
          if (error) return Alert.alert('Gagal', errorMessage(error));
          reload();
        },
      },
      {
        label: 'Hapus tagihan',
        destructive: true,
        onPress: async () => {
          const { error } = await supabase.from('bills').delete().eq('id', b.id);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          reload();
        },
      },
      ],
    });
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen
        options={{
          title: due.name,
          headerRight: () => (
            <Pressable onPress={exportPdf} hitSlop={10} disabled={bills.length === 0}>
              <Ionicons name={isPremium ? 'document-text-outline' : 'lock-closed-outline'} size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      {due.frequency === 'bulanan' && (
        <View style={[ui.row, { justifyContent: 'space-between', marginBottom: space.md }]}>
          <Pressable onPress={() => setMonth((m) => addMonths(m, -1))} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{bulanTahun(month)}</Text>
          <Pressable onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </Pressable>
        </View>
      )}

      <Card>
        <Muted>Terkumpul</Muted>
        <Body style={{ fontSize: 22, fontWeight: '800', color: colors.primary }}>
          {rupiah(collected)} <Muted>/ {rupiah(total)}</Muted>
        </Body>
        <ProgressBar value={total ? collected / total : 0} />
        <Muted style={{ marginTop: space.sm }}>
          {lunas.length} dari {bills.length} warga lunas
        </Muted>
      </Card>

      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'semua', label: `Semua (${bills.length})` },
          { value: 'belum_bayar', label: 'Belum bayar' },
          { value: 'menunggu_verifikasi', label: 'Menunggu' },
          { value: 'lunas', label: 'Lunas' },
        ]}
      />

      {bills.length === 0 ? (
        <Empty text="Belum ada tagihan untuk periode ini. Buat dari halaman Kelola Iuran." />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {shown.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => actions(b)}
              style={({ pressed }) => [ui.row, { paddingVertical: space.md, gap: space.md }, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1 }}>
                <Body numberOfLines={1}>{b.memberships?.profiles?.full_name || 'Warga'}</Body>
                <Muted numberOfLines={1}>
                  {b.memberships?.rt_units ? `RT ${b.memberships.rt_units.rt_number} · ` : ''}
                  {b.memberships?.address || '-'}
                  {due.frequency !== 'bulanan' ? ` · ${billPeriodLabel({ period: b.period, dues: due })}` : ''}
                </Muted>
              </View>
              <Badge
                text={BILL_STATUS_LABEL[b.status]}
                tone={b.status === 'lunas' ? 'success' : b.status === 'menunggu_verifikasi' ? 'warning' : 'danger'}
              />
            </Pressable>
          ))}
        </Card>
      )}
      <Muted style={{ textAlign: 'center' }}>
        Ketuk warga untuk mencatat pembayaran tunai. Ikon dokumen di kanan atas untuk export PDF.
        {scopeRtUnitId ? ` Hanya menampilkan warga ${rtLabel(scopeRtUnitId)}.` : ''}
      </Muted>
    </Screen>
  );
}
