import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Badge, Body, Button, Card, Chips, Empty, Fab, Loading, Muted, Screen, SectionTitle, Segmented, styles as ui } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { addMonths, bulanTahun, isoDate, monthEnd, monthStart, rupiah, tanggal } from '@/lib/format';
import { exportCashReportPdf } from '@/lib/pdf';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { CashReport, CashTransaction } from '@/lib/types';
import { must, useData } from '@/lib/useData';

type Range = 'bulan' | 'tahun';
/** '' = semua kas, 'rw' = kas RW saja, selain itu id RT */
type KasFilter = string;

export default function Kas() {
  const { profile } = useAuth();
  const { current, communityId, isPengurus, isPremium, canManageRt, rtUnits, rtLabel, scopeRtUnitId } = useCurrentCommunity();

  // Laporan kas tidak boleh di-screenshot / direkam layar selama halaman ini terbuka.
  // Pakai focus effect (bukan mount) karena tab tetap ter-mount saat pindah tab.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      ScreenCapture.preventScreenCaptureAsync('laporan-kas').catch(() => {});
      return () => {
        ScreenCapture.allowScreenCaptureAsync('laporan-kas').catch(() => {});
      };
    }, []),
  );
  const [range, setRange] = useState<Range>('bulan');
  const [anchor, setAnchor] = useState(() => monthStart(new Date()));
  const [kas, setKas] = useState<KasFilter>(scopeRtUnitId ?? '');
  const [exporting, setExporting] = useState(false);
  const isRW = current.communities.type === 'RW' && rtUnits.length > 0;

  const from = range === 'bulan' ? anchor : new Date(anchor.getFullYear(), 0, 1);
  const to = range === 'bulan' ? monthEnd(anchor) : new Date(anchor.getFullYear(), 11, 31);
  const fromStr = isoDate(from);
  const toStr = isoDate(to);
  const periodLabel = range === 'bulan' ? bulanTahun(anchor) : `Tahun ${anchor.getFullYear()}`;
  const kasLabel = !isRW ? 'Kas' : kas === '' ? 'Semua kas (RW + RT)' : kas === 'rw' ? 'Kas RW' : `Kas ${rtLabel(kas)}`;

  const load = useCallback(async () => {
    let q = supabase
      .from('cash_transactions')
      .select('*')
      .eq('community_id', communityId)
      .gte('trx_date', fromStr)
      .lte('trx_date', toStr)
      .order('trx_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (kas === 'rw') q = q.is('rt_unit_id', null);
    else if (kas) q = q.eq('rt_unit_id', kas);
    const [report, trx] = await Promise.all([
      supabase.rpc('cash_report', {
        p_community_id: communityId,
        p_from: fromStr,
        p_to: toStr,
        p_only_rw: kas === 'rw',
        p_rt_unit_id: kas && kas !== 'rw' ? kas : null,
      }),
      q,
    ]);
    return { report: must(report) as CashReport, trx: (must(trx) ?? []) as CashTransaction[] };
  }, [communityId, fromStr, toStr, kas]);

  const { data, loading, refreshing, refresh } = useData<{ report: CashReport; trx: CashTransaction[] } | null>(load, null);

  const step = (n: number) => setAnchor((a) => (range === 'bulan' ? addMonths(a, n) : new Date(a.getFullYear() + n, 0, 1)));

  async function exportPdf() {
    if (!data) return;
    if (!isPremium) {
      router.push('/premium');
      return;
    }
    setExporting(true);
    try {
      await exportCashReportPdf({
        community: current.communities,
        periodLabel,
        kasLabel,
        report: data.report,
        transactions: data.trx,
        rtLabel,
        printedBy: profile?.full_name || 'Pengguna',
        signers: isRW && kas && kas !== 'rw' ? [`Bendahara ${rtLabel(kas)}`, `Ketua ${rtLabel(kas)}`] : undefined,
      });
    } catch (e) {
      Alert.alert('Gagal membuat PDF', errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

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
      {isRW && (
        <Chips
          value={kas}
          onChange={setKas}
          options={[
            { value: '', label: 'Semua kas' },
            { value: 'rw', label: 'Kas RW' },
            ...rtUnits.map((r) => ({ value: r.id, label: `Kas RT ${r.rt_number}` })),
          ]}
        />
      )}
      <View style={[ui.row, { justifyContent: 'space-between', marginBottom: space.md }]}>
        <Pressable onPress={() => step(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{periodLabel}</Text>
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
          <Button
            title={isPremium ? 'Export PDF' : 'Export PDF · Premium'}
            icon={isPremium ? 'document-text-outline' : 'lock-closed-outline'}
            variant="secondary"
            loading={exporting}
            onPress={exportPdf}
            style={{ marginBottom: space.sm }}
          />

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
                const editable = !t.payment_id && canManageRt(t.rt_unit_id);
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
                      {isRW && kas === '' ? (
                        <View style={{ marginTop: 2 }}>
                          <Badge text={t.rt_unit_id ? `Kas ${rtLabel(t.rt_unit_id)}` : 'Kas RW'} />
                        </View>
                      ) : null}
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
            🔒 Halaman laporan dilindungi dari screenshot & rekam layar.{'\n'}
            Pemasukan iuran tercatat otomatis saat pembayaran diverifikasi
            {isRW ? ', masuk ke kas RT jika iurannya khusus RT' : ''}.
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
