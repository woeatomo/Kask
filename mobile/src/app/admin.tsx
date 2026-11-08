import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useActionSheet } from '@/components/ActionSheet';
import { Badge, Body, Button, Card, Chips, Empty, Loading, Muted, Screen, styles as ui } from '@/components/ui';
import { communityLabel, rupiah, tanggal } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { CommunityType } from '@/lib/types';
import { must, useData } from '@/lib/useData';

interface AdminRow {
  id: string;
  name: string;
  type: CommunityType;
  rw_number: string;
  rt_number: string | null;
  kota: string | null;
  is_active: boolean;
  created_at: string;
  member_count: number;
  ketua_name: string | null;
  ketua_phone: string | null;
  balance: number;
  plan: 'free' | 'premium';
  plan_expires_at: string | null;
  is_premium: boolean;
}

type Filter = 'semua' | 'premium' | 'gratis' | 'nonaktif';


export default function Admin() {
  const load = useCallback(async () => (must(await supabase.rpc('admin_list_communities')) ?? []) as AdminRow[], []);
  const { data, loading, refreshing, refresh, reload } = useData<AdminRow[]>(load, []);
  const sheet = useActionSheet();
  const [filter, setFilter] = useState<Filter>('semua');
  if (loading) return <Loading />;

  async function setPlan(c: AdminRow, plan: 'free' | 'premium', expires: string | null, note: string) {
    const { error } = await supabase.rpc('admin_set_plan', {
      p_community_id: c.id,
      p_plan: plan,
      p_expires_at: expires,
      p_note: note,
    });
    if (error) return Alert.alert('Gagal', errorMessage(error));
    reload();
  }

  function planMenu(c: AdminRow) {
    // perpanjangan dihitung dari tanggal berakhir saat ini jika masih aktif
    const base = c.is_premium && c.plan_expires_at ? new Date(c.plan_expires_at) : new Date();
    const extend = (months: number) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + months);
      return d.toISOString();
    };
    sheet({
      title: `Paket: ${c.name}`,
      message: c.is_premium
        ? `Premium ${c.plan_expires_at ? `s.d. ${tanggal(c.plan_expires_at)}` : 'tanpa batas'}`
        : 'Gratis',
      options: [
        { label: c.is_premium ? 'Perpanjang 1 bulan' : 'Premium 1 bulan', onPress: () => setPlan(c, 'premium', extend(1), 'Premium 1 bulan') },
        { label: c.is_premium ? 'Perpanjang 12 bulan' : 'Premium 12 bulan', onPress: () => setPlan(c, 'premium', extend(12), 'Premium 12 bulan') },
        { label: 'Uji coba 14 hari', onPress: () => setPlan(c, 'premium', new Date(Date.now() + 14 * 864e5).toISOString(), 'Uji coba 14 hari') },
        { label: 'Premium tanpa batas waktu', onPress: () => setPlan(c, 'premium', null, 'Premium tanpa batas') },
        ...(c.plan === 'premium' ? [{ label: 'Kembalikan ke Gratis', destructive: true, onPress: () => setPlan(c, 'free', null, 'Diturunkan ke gratis') }] : []),
      ],
    });
  }

  function toggle(c: AdminRow) {
    Alert.alert(c.is_active ? 'Nonaktifkan komunitas?' : 'Aktifkan komunitas?', c.name, [
      { text: 'Batal', style: 'cancel' },
      {
        text: c.is_active ? 'Nonaktifkan' : 'Aktifkan',
        style: c.is_active ? 'destructive' : 'default',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_set_community_active', { p_community_id: c.id, p_active: !c.is_active });
          if (error) return Alert.alert('Gagal', errorMessage(error));
          reload();
        },
      },
    ]);
  }

  const totalMembers = data.reduce((s, c) => s + Number(c.member_count), 0);
  const premiumCount = data.filter((c) => c.is_premium).length;
  const shown = data.filter((c) =>
    filter === 'premium' ? c.is_premium : filter === 'gratis' ? !c.is_premium : filter === 'nonaktif' ? !c.is_active : true,
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Card>
        <Muted>Total komunitas</Muted>
        <Body style={{ fontSize: 24, fontWeight: '800' }}>{data.length}</Body>
        <Muted>
          {totalMembers} anggota aktif · {premiumCount} premium
        </Muted>
      </Card>
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'semua', label: 'Semua' },
          { value: 'premium', label: `Premium (${premiumCount})` },
          { value: 'gratis', label: 'Gratis' },
          { value: 'nonaktif', label: 'Nonaktif' },
        ]}
      />
      {shown.length === 0 && <Empty text="Tidak ada komunitas" />}
      {shown.map((c) => (
        <Card key={c.id}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{c.name}</Body>
              <Muted>
                {communityLabel(c)}
                {c.kota ? ` · ${c.kota}` : ''}
              </Muted>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge text={c.is_active ? 'Aktif' : 'Nonaktif'} tone={c.is_active ? 'success' : 'danger'} />
              <Badge text={c.is_premium ? '⭐ Premium' : c.plan === 'premium' ? 'Premium habis' : 'Gratis'} tone={c.is_premium ? 'info' : c.plan === 'premium' ? 'warning' : 'neutral'} />
            </View>
          </View>
          <Muted style={{ marginTop: space.sm }}>
            Ketua: {c.ketua_name || '-'}
            {c.ketua_phone ? ` (${c.ketua_phone})` : ''} · {c.member_count} anggota · saldo {rupiah(c.balance)}
          </Muted>
          <Muted>
            Dibuat {tanggal(c.created_at)}
            {c.plan === 'premium' ? ` · premium ${c.plan_expires_at ? `s.d. ${tanggal(c.plan_expires_at)}` : 'tanpa batas'}` : ''}
          </Muted>
          <View style={[ui.row, { gap: space.sm, marginTop: space.sm }]}>
            <Button title="Atur paket" icon="star-outline" small variant="secondary" onPress={() => planMenu(c)} />
            <Button title={c.is_active ? 'Nonaktifkan' : 'Aktifkan'} small variant="ghost" onPress={() => toggle(c)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
