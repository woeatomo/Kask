import { useCallback } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Body, Button, Card, Empty, Loading, Muted, Screen, styles as ui } from '@/components/ui';
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
  balance: number;
}

export default function Admin() {
  const load = useCallback(async () => (must(await supabase.rpc('admin_list_communities')) ?? []) as AdminRow[], []);
  const { data, loading, refreshing, refresh, reload } = useData<AdminRow[]>(load, []);
  if (loading) return <Loading />;

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

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Card>
        <Muted>Total komunitas</Muted>
        <Body style={{ fontSize: 24, fontWeight: '800' }}>{data.length}</Body>
        <Muted>{totalMembers} anggota aktif</Muted>
      </Card>
      {data.length === 0 && <Empty text="Belum ada komunitas" />}
      {data.map((c) => (
        <Card key={c.id}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{c.name}</Body>
              <Muted>
                {communityLabel(c)}
                {c.kota ? ` · ${c.kota}` : ''}
              </Muted>
            </View>
            <Badge text={c.is_active ? 'Aktif' : 'Nonaktif'} tone={c.is_active ? 'success' : 'danger'} />
          </View>
          <Muted style={{ marginTop: space.sm }}>
            Ketua: {c.ketua_name || '-'} · {c.member_count} anggota · saldo {rupiah(c.balance)}
          </Muted>
          <Muted>Dibuat {tanggal(c.created_at)}</Muted>
          <Button
            title={c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            small
            variant={c.is_active ? 'ghost' : 'secondary'}
            onPress={() => toggle(c)}
            style={{ alignSelf: 'flex-start', marginTop: space.sm }}
          />
        </Card>
      ))}
    </Screen>
  );
}
