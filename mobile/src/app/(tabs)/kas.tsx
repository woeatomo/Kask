import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Card, Empty, Fab, Loading, Muted, Screen, SectionTitle, Segmented, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { addMonths, bulanTahun, isoDate, monthEnd, monthStart, rupiah, tanggal } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { CashReport, CashTransaction } from '@/lib/types';
import { must, useData } from '@/lib/useData';

type Range = 'bulan' | 'tahun';

export default function Kas() {
  const { communityId, isPengurus } = useCurrentCommunity();
  const [range, setRange] = useState<Range>('bulan');
  const [anchor, setAnchor] = useState(() => monthStart(new Date()));

  const from = range === 'bulan' ? anchor : new Date(anchor.getFullYear(), 0, 1);
  const to = range === 'bulan' ? monthEnd(anchor) : new Date(anchor.getFullYear(), 11, 31);
  const fromStr = isoDate(from);
  const toStr = isoDate(to);

  const load = useCallback(async () => {
    const [report, trx] = await Promise.all([
      supabase.rpc('cash_report', { p_community_id: communityId, p_from: fromStr, p_to: toStr }),
      supabase
        .from('cash_transactions')
        .select('*')
        .eq('community_id', communityId)
        .gte('trx_date', fromStr)
        .lte('trx_date', toStr)
        .order('trx_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    return { report: must(report) as CashReport, trx: (must(trx) ?? []) as CashTransaction[] };
  }, [communityId, fromStr, toStr]);

  const { data, loading, refreshing, refresh } = useData<{ report: CashReport; trx: CashTransaction[] } | null>(load, null);

  const step = (n: number) => setAnchor((a) => (range === 'bulan' ? addMonths(a, n) : new Date(a.getFullYear() + n, 0, 1)));

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={refresh}
      footer={isPengurus ? <Fab onPress={() => router.push('/manage/cash-form')} /> : undefined}
    >
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: 'bulan', label: 'Bulanan' },
          { value: 'tahun', label: 'Tahunan' },
        ]}
      />
      <View style={[ui.row, { justifyContent: 'space-between', marginBottom: space.md }]}>
        <Pressable onPress={() => step(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
          {range === 'bulan' ? bulanTahun(anchor) : `Tahun ${anchor.getFullYear()}`}
        </Text>
        <Pressable onPress={() => step(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {loading || !data ? (
        <Loading />
      ) : (
        <>
          <Card>
            <Row label="Saldo awal" value={data.report.opening_balance} />
            <Row label="Pemasukan" value={data.report.income} color={colors.success} prefix="+" />
            <Row label="Pengeluaran" value={data.report.expense} color={colors.danger} prefix="−" />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />
            <Row label="Saldo akhir" value={data.report.closing_balance} bold />
          </Card>

          {data.report.by_category.length > 0 && (
            <>
              <SectionTitle>Per kategori</SectionTitle>
              <Card>
                {data.report.by_category.map((c) => (
                  <Row
                    key={c.type + c.category}
                    label={c.category}
                    value={c.total}
                    color={c.type === 'masuk' ? colors.success : colors.danger}
                    prefix={c.type === 'masuk' ? '+' : '−'}
                  />
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Transaksi</SectionTitle>
          {data.trx.length === 0 ? (
            <Empty icon="receipt-outline" text="Tidak ada transaksi di periode ini" />
          ) : (
            <Card style={{ paddingVertical: space.sm }}>
              {data.trx.map((t) => {
                const editable = isPengurus && !t.payment_id;
                return (
                  <Pressable
                    key={t.id}
                    disabled={!editable}
                    onPress={() => router.push({ pathname: '/manage/cash-form', params: { id: t.id } })}
                    style={({ pressed }) => [ui.row, { paddingVertical: space.sm, gap: space.md }, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons
                      name={t.type === 'masuk' ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={28}
                      color={t.type === 'masuk' ? colors.success : colors.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Body numberOfLines={1}>{t.description || t.category}</Body>
                      <Muted>
                        {tanggal(t.trx_date)} · {t.category}
                      </Muted>
                    </View>
                    <Body style={{ fontWeight: '700', color: t.type === 'masuk' ? colors.success : colors.danger }}>
                      {t.type === 'masuk' ? '+' : '−'}
                      {rupiah(t.amount)}
                    </Body>
                  </Pressable>
                );
              })}
            </Card>
          )}
          <Muted style={{ textAlign: 'center', marginTop: space.sm }}>
            Pemasukan iuran tercatat otomatis saat pembayaran diverifikasi.
          </Muted>
        </>
      )}
    </Screen>
  );
}

function Row({ label, value, color, prefix = '', bold }: { label: string; value: number; color?: string; prefix?: string; bold?: boolean }) {
  return (
    <View style={[ui.row, { justifyContent: 'space-between', paddingVertical: 4 }]}>
      <Body style={bold && { fontWeight: '700' }}>{label}</Body>
      <Body style={[{ color: color ?? colors.text }, bold && { fontWeight: '800', fontSize: 17 }]}>
        {prefix}
        {rupiah(value)}
      </Body>
    </View>
  );
}
